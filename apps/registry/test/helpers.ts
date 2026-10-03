import { env, SELF } from 'cloudflare:test';
import { DEV_KEY } from '../scripts/dev-key.mjs';
import { buildSeed, FIXTURES } from '../scripts/seed-lib.mjs';

export { DEV_KEY, FIXTURES };

/** Siembra los fixtures una vez por archivo de test (el almacenamiento D1 se comparte dentro del archivo). */
export async function seed(manifests?: object[], offset = 0): Promise<void> {
  if (!manifests) {
    const row = await env.DB.prepare("SELECT count(*) AS n FROM packages WHERE id LIKE 'pkg_fixture%'").first<{
      n: number;
    }>();
    if (row && row.n > 0) return;
  }
  const sql = await buildSeed({
    keyId: DEV_KEY.id,
    privateKey: DEV_KEY.private,
    publicKey: DEV_KEY.public,
    manifests,
    offset,
  });
  await env.DB.batch(sql.map((s) => env.DB.prepare(s)));
}

export async function get(path: string, init: RequestInit = {}): Promise<Response> {
  return SELF.fetch(`https://api.genpm.net${path}`, init);
}

export async function json<T = Record<string, unknown>>(
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; body: T; res: Response }> {
  const res = await get(path, init);
  return { status: res.status, body: (await res.json()) as T, res };
}

import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import worker from '../src/index.js';
import { hashToken, newToken } from '../src/services/tokens.js';
import type { FakeGitHub } from './fake-github.js';

/** Llama al Worker en el mismo isolate (permite interceptar `fetch` saliente con un GitHub falso). */
export async function call(path: string, init: RequestInit = {}, gh?: FakeGitHub): Promise<Response> {
  const original = globalThis.fetch;
  if (gh) globalThis.fetch = gh.fetch.bind(gh) as typeof fetch;
  try {
    const ctx = createExecutionContext();
    const res = await worker.fetch(new Request(`https://api.genpm.net${path}`, init) as never, env, ctx);
    await waitOnExecutionContext(ctx);
    return res as unknown as Response;
  } finally {
    globalThis.fetch = original;
  }
}

let accountSeq = 0;

/** Crea una cuenta (y opcionalmente una org con membresía) y devuelve un token `gpm_` válido. */
export async function account(opts: {
  login: string;
  githubId?: number;
  staff?: boolean;
  orgs?: Array<{ login: string; role: string }>;
  scopes?: string[];
  expiresAt?: number | null;
}): Promise<{ id: string; token: string }> {
  accountSeq++;
  const id = `acc_test${accountSeq}${opts.login}`;
  const now = Date.now();
  const stmts = [
    env.DB.prepare(
      'INSERT INTO accounts (id, kind, handle, github_id, github_login, is_staff, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)',
    ).bind(id, 'user', opts.login, opts.githubId ?? 1000 + accountSeq, opts.login, opts.staff ? 1 : 0, now),
  ];
  if (opts.staff)
    stmts.push(
      env.DB.prepare(
        "INSERT INTO memberships (org_id, user_id, role, source, created_at) VALUES ('acc_system', ?1, 'admin', 'manual', ?2)",
      ).bind(id, now),
    );
  for (const org of opts.orgs ?? []) {
    const orgId = `acc_org_${org.login}`;
    stmts.push(
      env.DB.prepare(
        "INSERT OR IGNORE INTO accounts (id, kind, handle, github_id, github_login, created_at, updated_at) VALUES (?1, 'org', ?2, ?3, ?2, ?4, ?4)",
      ).bind(
        orgId,
        org.login,
        900_000 + ([...org.login].reduce((n, ch) => n * 31 + ch.charCodeAt(0), 7) % 90_000),
        now,
      ),
    );
    stmts.push(
      env.DB.prepare(
        "INSERT INTO memberships (org_id, user_id, role, source, created_at) VALUES (?1, ?2, ?3, 'github', ?4)",
      ).bind(orgId, id, org.role, now),
    );
  }
  const token = newToken();
  stmts.push(
    env.DB.prepare(
      'INSERT INTO api_tokens (id, account_id, name, token_prefix, token_hash, scopes, expires_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)',
    ).bind(
      `tok_test${accountSeq}`,
      id,
      'test',
      token.slice(0, 8),
      await hashToken(env.TOKEN_PEPPER!, token),
      JSON.stringify(opts.scopes ?? ['read', 'publish']),
      opts.expiresAt === undefined ? now + 86_400_000 : opts.expiresAt,
      now,
    ),
  );
  await env.DB.batch(stmts);
  return { id, token };
}

/** Borra los paquetes de un scope (el almacenamiento D1 se comparte entre tests del mismo archivo). */
export async function wipeScope(scope: string): Promise<void> {
  const like = `@${scope}/%`;
  const ids = '(SELECT id FROM packages WHERE full_name LIKE ?1)';
  await env.DB.batch([
    env.DB.prepare(
      `DELETE FROM package_dependencies WHERE version_id IN (SELECT id FROM package_versions WHERE package_id IN ${ids})`,
    ).bind(like),
    env.DB.prepare(`DELETE FROM dist_tags WHERE package_id IN ${ids}`).bind(like),
    env.DB.prepare(`DELETE FROM package_keywords WHERE package_id IN ${ids}`).bind(like),
    env.DB.prepare(`DELETE FROM packages_fts WHERE package_id IN ${ids}`).bind(like),
    env.DB.prepare(`DELETE FROM packages_fts_cjk WHERE package_id IN ${ids}`).bind(like),
    env.DB.prepare(`DELETE FROM package_versions WHERE package_id IN ${ids}`).bind(like),
    env.DB.prepare('DELETE FROM packages WHERE full_name LIKE ?1').bind(like),
    env.DB.prepare('DELETE FROM scopes WHERE name = ?1').bind(scope),
    env.DB.prepare("DELETE FROM audit_log WHERE action = 'package.publish'"),
  ]);
}
