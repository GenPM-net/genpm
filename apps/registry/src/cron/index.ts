// Cron Triggers (api-spec §8):
//   0 * * * *   rollup Analytics Engine → install_stats_daily; installs_30d e installs_total.
//   15 3 * * *  popularity_score, patrocinios por fecha, auditoría tag → SHA y repos inaccesibles (security §3.3).
//   0 4 * * 0   re-sync de membresías de GitHub con synced_at > 7 días.
//   0 * * * *   además: re-firma por lotes las versiones cuya firma no es de la clave activa (rotación, runbook §2).

import type { Env } from '../env.js';
import { newId } from '../ids.js';
import { GitHub, parseGithubRepo } from '../services/github.js';
import { activeSigningKey, sign } from '../services/signing.js';

const DAY = 86_400_000;

type Row = { name: string; client: string; day: string; n: number | string };

/** Consulta la SQL API de Analytics Engine (solo producción/staging; sin credenciales no hace nada). */
async function aeRows(env: Env, fetchImpl: typeof fetch): Promise<Row[]> {
  if (!env.CF_ACCOUNT_ID || !env.CF_AE_TOKEN) return [];
  const dataset = env.ENVIRONMENT === 'staging' ? 'genpm_installs_staging' : 'genpm_installs';
  const sql = `SELECT blob1 AS name, blob3 AS client, formatDateTime(timestamp, '%Y-%m-%d') AS day, SUM(_sample_interval) AS n FROM ${dataset} WHERE timestamp > NOW() - INTERVAL '2' DAY GROUP BY name, client, day FORMAT JSON`;
  const res = await fetchImpl(
    `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/analytics_engine/sql`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${env.CF_AE_TOKEN}` },
      body: sql,
    },
  );
  if (!res.ok) throw new Error(`analytics engine ${res.status}`);
  return ((await res.json()) as { data: Row[] }).data;
}

export async function rollupInstalls(env: Env, fetchImpl: typeof fetch = fetch, rows?: Row[]): Promise<number> {
  const data = rows ?? (await aeRows(env, fetchImpl));
  const db = env.DB;
  const agg = new Map<string, { name: string; day: string; installs: number; mcp: number }>();
  for (const r of data) {
    const key = `${r.name}|${r.day}`;
    const cur = agg.get(key) ?? { name: r.name, day: r.day, installs: 0, mcp: 0 };
    cur.installs += Number(r.n);
    if (r.client === 'mcp') cur.mcp += Number(r.n);
    agg.set(key, cur);
  }
  const stmts: D1PreparedStatement[] = [];
  for (const a of agg.values()) {
    stmts.push(
      db
        .prepare(
          `INSERT INTO install_stats_daily (package_id, day, installs, via_mcp)
           SELECT id, ?2, ?3, ?4 FROM packages WHERE full_name = ?1 AND registry_id = 'reg_public'
           ON CONFLICT (package_id, day) DO UPDATE SET installs = ?3, via_mcp = ?4`,
        )
        .bind(a.name, a.day, Math.round(a.installs), Math.round(a.mcp)),
    );
  }
  stmts.push(
    db.prepare(
      `UPDATE packages SET
         installs_30d = coalesce((SELECT sum(installs) FROM install_stats_daily s WHERE s.package_id = packages.id AND s.day >= date('now', '-30 days')), 0),
         installs_total = coalesce((SELECT sum(installs) FROM install_stats_daily s WHERE s.package_id = packages.id), 0)`,
    ),
  );
  await db.batch(stmts);
  return agg.size;
}

/** popularity_score = ln(1 + installs_30d)/10 + verificado + recencia (api-spec §5.3). */
export async function recomputePopularity(env: Env, now = Date.now()): Promise<void> {
  await env.DB.prepare(
    `UPDATE packages SET popularity_score =
       ln(1 + installs_30d) / 10.0
       + (SELECT CASE WHEN a.is_verified = 1 THEN 0.5 ELSE 0 END FROM accounts a WHERE a.id = packages.owner_id)
       + CASE WHEN updated_at > ?1 THEN 0.3 WHEN updated_at > ?2 THEN 0.1 ELSE 0 END`,
  )
    .bind(now - 30 * DAY, now - 180 * DAY)
    .run();
}

export async function syncSponsorships(env: Env, now = Date.now()): Promise<void> {
  await env.DB.batch([
    env.DB.prepare("UPDATE sponsorships SET status = 'ended' WHERE status = 'active' AND ends_at < ?1").bind(now),
    env.DB.prepare(
      `UPDATE packages SET is_sponsored = CASE WHEN EXISTS (
         SELECT 1 FROM sponsorships s WHERE s.package_id = packages.id AND s.status = 'active' AND ?1 BETWEEN s.starts_at AND s.ends_at
       ) THEN 1 ELSE 0 END`,
    ).bind(now),
  ]);
}

/** Auditoría tag → SHA de las versiones latest y detección de repos inaccesibles o recreados (repojacking). */
export async function auditTags(env: Env, limit = 200): Promise<{ moved: string[]; unavailable: string[] }> {
  const gh = new GitHub(env);
  const { results } = await env.DB.prepare(
    `SELECT p.id AS pid, p.full_name, p.repo_url, p.git_repo_id, p.registry_id, v.id AS vid, v.git_ref, v.commit_sha
     FROM packages p JOIN package_versions v ON v.id = p.latest_version_id
     WHERE p.status = 'active' ORDER BY p.updated_at LIMIT ?1`,
  )
    .bind(limit)
    .all<{
      pid: string;
      full_name: string;
      repo_url: string;
      git_repo_id: number | null;
      registry_id: string;
      vid: string;
      git_ref: string;
      commit_sha: string;
    }>();
  const moved: string[] = [];
  const unavailable: string[] = [];
  const now = Date.now();
  for (const r of results) {
    const coords = parseGithubRepo(r.repo_url);
    if (!coords) continue;
    try {
      const repo = await gh.repo(coords.owner, coords.repo);
      if (!repo || (r.git_repo_id && repo.id !== r.git_repo_id)) {
        unavailable.push(r.full_name);
        await env.DB.batch([
          env.DB.prepare("UPDATE packages SET source_status = 'unavailable' WHERE id = ?1").bind(r.pid),
          env.DB.prepare(
            "INSERT INTO audit_log (id, registry_id, actor_id, action, target_type, target_id, metadata, created_at) VALUES (?1, ?2, NULL, 'package.source_unavailable', 'package', ?3, ?4, ?5)",
          ).bind(
            newId('aud'),
            r.registry_id,
            r.pid,
            JSON.stringify({ repo: r.repo_url, repoId: repo?.id ?? null }),
            now,
          ),
        ]);
        continue;
      }
      if (/^[0-9a-f]{40}$/.test(r.git_ref)) continue;
      const sha = await gh.commitSha(coords.owner, coords.repo, r.git_ref);
      if (sha && sha !== r.commit_sha) {
        moved.push(r.full_name);
        await env.DB.prepare(
          "INSERT INTO audit_log (id, registry_id, actor_id, action, target_type, target_id, metadata, created_at) VALUES (?1, ?2, NULL, 'version.tag_moved', 'version', ?3, ?4, ?5)",
        )
          .bind(
            newId('aud'),
            r.registry_id,
            r.vid,
            JSON.stringify({ ref: r.git_ref, published: r.commit_sha, now: sha }),
            now,
          )
          .run();
        console.warn(JSON.stringify({ level: 'alert', event: 'tag_moved', pkg: r.full_name, ref: r.git_ref }));
      }
    } catch (e) {
      console.error(JSON.stringify({ level: 'error', event: 'tag_audit', pkg: r.full_name, error: String(e) }));
    }
  }
  return { moved, unavailable };
}

/** Membresías de GitHub sincronizadas hace > 7 días: se refrescan con la GitHub App (si está instalada en la org). */
export async function resyncMemberships(env: Env, now = Date.now()): Promise<number> {
  const { results } = await env.DB.prepare(
    "SELECT DISTINCT a.id, a.github_login FROM memberships m JOIN accounts a ON a.id = m.org_id WHERE m.source = 'github' AND (m.synced_at IS NULL OR m.synced_at < ?1) AND a.github_login IS NOT NULL LIMIT 50",
  )
    .bind(now - 7 * DAY)
    .all<{ id: string; github_login: string }>();
  const gh = new GitHub(env);
  let synced = 0;
  for (const org of results) {
    const members = await gh
      .json<Array<{ id: number }>>(`/orgs/${org.github_login}/members?per_page=100`)
      .catch(() => null);
    if (!members) continue;
    const ids = JSON.stringify(members.map((m) => m.id));
    await env.DB.batch([
      env.DB.prepare(
        "DELETE FROM memberships WHERE org_id = ?1 AND source = 'github' AND user_id IN (SELECT id FROM accounts WHERE github_id NOT IN (SELECT value FROM json_each(?2)))",
      ).bind(org.id, ids),
      env.DB.prepare("UPDATE memberships SET synced_at = ?2 WHERE org_id = ?1 AND source = 'github'").bind(org.id, now),
    ]);
    synced++;
  }
  return synced;
}

/**
 * Rotación de clave (security §4.3): cuando cambia SIGNING_KEY_ID, re-firma con la clave activa las versiones firmadas
 * con otra, por lotes, para poder revocar la clave anterior sin romper instalaciones. Devuelve cuántas re-firmó.
 */
export async function resignStale(env: Env, limit = 500): Promise<number> {
  const { keyId } = await activeSigningKey(env);
  const { results } = await env.DB.prepare(
    "SELECT id, manifest FROM package_versions WHERE signature IS NULL OR substr(signature, 1, length(?1) + 1) != ?1 || ':' LIMIT ?2",
  )
    .bind(keyId, limit)
    .all<{ id: string; manifest: string }>();
  for (const row of results) {
    const sg = await sign(env, JSON.parse(row.manifest) as Record<string, unknown>);
    await env.DB.prepare('UPDATE package_versions SET signature = ?1 WHERE id = ?2').bind(sg, row.id).run();
  }
  return results.length;
}

export async function runCron(cron: string, env: Env): Promise<void> {
  if (cron === '0 * * * *') {
    await rollupInstalls(env);
    await resignStale(env);
  } else if (cron === '15 3 * * *') {
    await recomputePopularity(env);
    await syncSponsorships(env);
    await auditTags(env);
  } else if (cron === '0 4 * * 0') await resyncMemberships(env);
}
