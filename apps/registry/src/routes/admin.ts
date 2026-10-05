// /v1/admin/* (solo staff): GET /analytics para el panel /admin/analytics (ADR-027) y la cola de moderación /queue
// (V02-08). Lee Analytics Engine
// (visitas e instalaciones, sin identificadores) y D1 (publicaciones, logins y cuentas nuevas). Nunca se cachea.
import type { Context, MiddlewareHandler } from 'hono';
import { Hono } from 'hono';
import { z } from 'zod';
import { purgePackage } from '../cache.js';
import type { AppEnv } from '../env.js';
import { httpError } from '../http.js';
import { newId } from '../ids.js';
import { requireAuth } from '../middleware/auth.js';
import { aeConfigured, aeDataset, aeQuery } from '../services/ae.js';

const DAY = 86_400_000;

type KV = { k: string; n: number };

/** Solo staff; al resto se le responde como si la ruta no existiera. */
const staffOnly: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get('actor')?.isStaff) throw httpError('E_NOT_FOUND', { name: c.req.path });
  await next();
};

async function audit(
  c: Context<AppEnv>,
  action: string,
  targetType: string,
  targetId: string,
  metadata: Record<string, unknown>,
): Promise<D1PreparedStatement> {
  return c.env.DB.prepare(
    'INSERT INTO audit_log (id, registry_id, actor_id, action, target_type, target_id, metadata, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)',
  ).bind(
    newId('aud'),
    c.get('tenant').registryId,
    c.get('actor')!.accountId,
    action,
    targetType,
    targetId,
    JSON.stringify(metadata),
    Date.now(),
  );
}

export const admin = new Hono<AppEnv>()
  .use('*', requireAuth(), staffOnly)
  .get('/analytics', async (c) => {
    const days = Math.min(90, Math.max(1, Number.parseInt(c.req.query('days') ?? '7', 10) || 7));
    const sinceMs = Date.now() - (days - 1) * DAY;
    const since = new Date(sinceMs).toISOString().slice(0, 10);
    const startMs = Date.parse(`${since}T00:00:00Z`);
    const env = c.env;
    const db = env.DB;
    const registryId = c.get('tenant').registryId;

    const d1 = db
      .prepare(
        `SELECT strftime('%Y-%m-%d', created_at / 1000, 'unixepoch') AS day, action, count(*) AS n FROM audit_log
       WHERE registry_id = ?1 AND created_at >= ?2 AND action IN ('package.publish', 'auth.login') GROUP BY day, action
       UNION ALL
       SELECT strftime('%Y-%m-%d', created_at / 1000, 'unixepoch') AS day, 'account.create' AS action, count(*) AS n
       FROM accounts WHERE created_at >= ?2 AND kind = 'user' GROUP BY day ORDER BY day`,
      )
      .bind(registryId, startMs)
      .all<{ day: string; action: string; n: number }>();

    if (!aeConfigured(env)) {
      return c.json({ days, since, configured: false, web: null, installs: null, registry: (await d1).results });
    }
    const W = aeDataset(env, 'web');
    const I = aeDataset(env, 'installs');
    const ts = `timestamp >= toDateTime('${since} 00:00:00')`;
    const day = `formatDateTime(timestamp, '%Y-%m-%d')`;
    const n = 'SUM(_sample_interval)';
    const top = (ds: string, col: string, where: string, limit = 20) =>
      aeQuery<KV>(
        env,
        `SELECT ${col} AS k, ${n} AS n FROM ${ds} WHERE ${ts} AND ${where} GROUP BY k ORDER BY n DESC LIMIT ${limit} FORMAT JSON`,
      );
    // Personas sin sesión: las visitas con sesión (fundador, staff, autores) se cuentan aparte como `member`.
    const people = "blob5 = 'human'";
    const [
      webDaily,
      referrers,
      pages,
      countries,
      campaigns,
      packages,
      searches,
      instDaily,
      instPackages,
      instCountries,
      versions,
      registry,
    ] = await Promise.all([
      aeQuery<{ day: string; event: string; who: string; n: number }>(
        env,
        `SELECT ${day} AS day, blob1 AS event, blob5 AS who, ${n} AS n FROM ${W} WHERE ${ts} GROUP BY day, event, who ORDER BY day FORMAT JSON`,
      ),
      top(W, 'blob6', `blob1 = 'page_view' AND ${people} AND blob6 != ''`),
      top(W, 'blob2', `blob1 = 'page_view' AND ${people}`),
      top(W, 'blob7', `blob1 = 'page_view' AND ${people} AND blob7 != ''`),
      top(W, 'blob8', `blob1 = 'page_view' AND blob8 != ''`),
      top(W, 'blob2', `blob1 = 'pkg_view' AND ${people}`),
      aeQuery<KV & { results: number }>(
        env,
        `SELECT blob2 AS k, ${n} AS n, MAX(double1) AS results FROM ${W} WHERE ${ts} AND blob1 = 'search' AND blob5 != 'bot' GROUP BY k ORDER BY n DESC LIMIT 30 FORMAT JSON`,
      ),
      aeQuery<{ day: string; client: string; n: number }>(
        env,
        `SELECT ${day} AS day, blob3 AS client, ${n} AS n FROM ${I} WHERE ${ts} AND blob3 IN ('cli', 'mcp') GROUP BY day, client ORDER BY day FORMAT JSON`,
      ),
      top(I, 'blob1', "blob3 IN ('cli', 'mcp')"),
      top(I, 'blob5', "blob3 IN ('cli', 'mcp') AND blob5 != ''"),
      top(I, 'blob4', "blob3 = 'cli' AND blob4 != ''", 10),
      d1,
    ]);
    const num = <T extends { n: number | string }>(rows: T[]) => rows.map((r) => ({ ...r, n: Number(r.n) }));
    return c.json({
      days,
      since,
      configured: true,
      web: {
        daily: num(webDaily),
        referrers: num(referrers),
        pages: num(pages),
        countries: num(countries),
        campaigns: num(campaigns),
        packages: num(packages),
        searches: num(searches).map((s) => ({ ...s, results: Number(s.results) })),
      },
      installs: {
        daily: num(instDaily),
        packages: num(instPackages),
        countries: num(instCountries),
        cliVersions: num(versions),
      },
      registry: registry.results,
    });
  })
  // ───────────── Cola de moderación (V02-08, web-ui-spec §3 /admin) ─────────────
  .get('/queue', async (c) => {
    const db = c.env.DB;
    const rid = c.get('tenant').registryId;
    const [versions, reports, featured, sponsorships, leads] = await Promise.all([
      db
        .prepare(
          `SELECT v.id, p.full_name AS name, v.version, v.scan_status AS scan, v.status, v.scan_report AS report, v.published_at AS at
           FROM package_versions v JOIN packages p ON p.id = v.package_id
           WHERE p.registry_id = ?1 AND (v.status = 'quarantined' OR v.scan_status IN ('flagged', 'failed', 'pending'))
           ORDER BY v.published_at DESC LIMIT 100`,
        )
        .bind(rid)
        .all<{
          id: string;
          name: string;
          version: string;
          scan: string;
          status: string;
          report: string | null;
          at: number;
        }>(),
      db
        .prepare(
          `SELECT r.id, p.full_name AS name, v.version, r.reason, r.details, r.status, r.created_at AS at, a.handle AS reporter
           FROM reports r JOIN packages p ON p.id = r.package_id
           LEFT JOIN package_versions v ON v.id = r.version_id LEFT JOIN accounts a ON a.id = r.reporter_id
           WHERE p.registry_id = ?1 AND r.status IN ('open', 'triaged') ORDER BY r.created_at DESC LIMIT 100`,
        )
        .bind(rid)
        .all(),
      db
        .prepare(
          'SELECT id, full_name AS name, featured_rank AS rank FROM packages WHERE registry_id = ?1 AND is_featured = 1 ORDER BY featured_rank',
        )
        .bind(rid)
        .all(),
      db
        .prepare(
          `SELECT s.id, p.full_name AS name, s.placement, s.target, s.status, s.starts_at AS startsAt, s.ends_at AS endsAt, s.impressions, s.clicks
           FROM sponsorships s JOIN packages p ON p.id = s.package_id WHERE s.registry_id = ?1 AND s.status IN ('draft', 'active', 'paused')
           ORDER BY s.starts_at DESC LIMIT 100`,
        )
        .bind(rid)
        .all(),
      db
        .prepare(
          "SELECT id, kind, email, company, details, status, created_at AS at FROM leads WHERE status IN ('new', 'contacted') ORDER BY created_at DESC LIMIT 100",
        )
        .all(),
    ]);
    return c.json({
      versions: versions.results.map(({ report, ...v }) => ({
        ...v,
        findings: report ? ((JSON.parse(report) as { findings?: unknown[] }).findings ?? []).slice(0, 10) : [],
      })),
      reports: reports.results,
      featured: featured.results,
      sponsorships: sponsorships.results,
      leads: leads.results.map((l) => ({ ...l, details: l['details'] ? JSON.parse(String(l['details'])) : null })),
    });
  })
  .post('/versions/:id{ver_[0-9A-Za-z]+}', async (c) => {
    const body = z
      .strictObject({ action: z.enum(['release', 'quarantine']), note: z.string().max(500).optional() })
      .safeParse(await c.req.json().catch(() => null));
    if (!body.success) throw httpError('E_BAD_REQUEST', { detail: 'action' });
    const id = c.req.param('id');
    const v = await c.env.DB.prepare(
      'SELECT v.id, p.full_name FROM package_versions v JOIN packages p ON p.id = v.package_id WHERE v.id = ?1 AND p.registry_id = ?2',
    )
      .bind(id, c.get('tenant').registryId)
      .first<{ id: string; full_name: string }>();
    if (!v) throw httpError('E_NOT_FOUND', { name: id });
    const release = body.data.action === 'release';
    await c.env.DB.batch([
      c.env.DB.prepare(
        release
          ? "UPDATE package_versions SET status = 'active', scan_status = 'passed' WHERE id = ?1"
          : "UPDATE package_versions SET status = 'quarantined' WHERE id = ?1",
      ).bind(id),
      await audit(c, release ? 'version.release' : 'version.quarantine', 'version', id, {
        note: body.data.note ?? null,
      }),
    ]);
    c.executionCtx.waitUntil(purgePackage(c, v.full_name));
    return c.json({ ok: true });
  })
  .post('/reports/:id', async (c) => {
    const body = z
      .strictObject({ status: z.enum(['triaged', 'actioned', 'dismissed']), note: z.string().max(500).optional() })
      .safeParse(await c.req.json().catch(() => null));
    if (!body.success) throw httpError('E_BAD_REQUEST', { detail: 'status' });
    const id = c.req.param('id');
    const r = await c.env.DB.prepare('UPDATE reports SET status = ?1 WHERE id = ?2').bind(body.data.status, id).run();
    if (!r.meta.changes) throw httpError('E_NOT_FOUND', { name: id });
    await (await audit(c, `report.${body.data.status}`, 'report', id, { note: body.data.note ?? null })).run();
    return c.json({ ok: true });
  })
  .post('/packages/:id{pkg_[0-9A-Za-z]+}/featured', async (c) => {
    const body = z
      .strictObject({ rank: z.number().int().min(1).max(99).nullable() })
      .safeParse(await c.req.json().catch(() => null));
    if (!body.success) throw httpError('E_BAD_REQUEST', { detail: 'rank' });
    const id = c.req.param('id');
    const r = await c.env.DB.prepare(
      'UPDATE packages SET is_featured = ?1, featured_rank = ?2 WHERE id = ?3 AND registry_id = ?4',
    )
      .bind(body.data.rank === null ? 0 : 1, body.data.rank, id, c.get('tenant').registryId)
      .run();
    if (!r.meta.changes) throw httpError('E_NOT_FOUND', { name: id });
    await (await audit(c, 'package.featured', 'package', id, { rank: body.data.rank })).run();
    return c.json({ ok: true });
  })
  .post('/leads/:id', async (c) => {
    const body = z
      .strictObject({ status: z.enum(['new', 'contacted', 'won', 'lost']) })
      .safeParse(await c.req.json().catch(() => null));
    if (!body.success) throw httpError('E_BAD_REQUEST', { detail: 'status' });
    const id = c.req.param('id');
    const r = await c.env.DB.prepare('UPDATE leads SET status = ?1 WHERE id = ?2').bind(body.data.status, id).run();
    if (!r.meta.changes) throw httpError('E_NOT_FOUND', { name: id });
    await (await audit(c, `lead.${body.data.status}`, 'lead', id, {})).run();
    return c.json({ ok: true });
  });
