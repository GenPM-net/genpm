// Login del CLI (device flow, architecture §6.5) y gestión del token actual (api-spec §4.7–4.8).
// El token de GitHub solo se usa para leer /user y las orgs; nunca se persiste.

import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../env.js';
import { httpError } from '../http.js';
import { newId } from '../ids.js';
import { requireAuth } from '../middleware/auth.js';
import { clientIp, rateLimit } from '../middleware/rate-limit.js';
import { hashIp, hashToken, newToken } from '../services/tokens.js';

const CLI_TOKEN_DAYS = 90;

type GhUser = {
  id: number;
  login: string;
  avatar_url: string | null;
  email: string | null;
  name?: string | null;
  two_factor_authentication?: boolean;
};
type GhMembership = {
  role: 'admin' | 'member';
  state: string;
  organization: { id: number; login: string; avatar_url?: string };
};

async function gh<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'genpm-registry',
      'x-github-api-version': '2022-11-28',
    },
    redirect: 'manual',
  });
  if (res.status === 401) throw httpError('E_AUTH');
  if (!res.ok) throw httpError('E_UPSTREAM_GIT', { detail: `GitHub ${res.status}` });
  return (await res.json()) as T;
}

const Exchange = z.strictObject({ githubToken: z.string().min(10).max(255), name: z.string().max(64).optional() });

export const auth = new Hono<AppEnv>()
  .post('/github/exchange', rateLimit('exchange'), async (c) => {
    const parsed = Exchange.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw httpError('E_BAD_REQUEST', { detail: 'githubToken' });
    if (!c.env.TOKEN_PEPPER) throw httpError('E_INTERNAL', {}, { cause: 'TOKEN_PEPPER missing' });
    const user = await gh<GhUser>('/user', parsed.data.githubToken);
    const memberships = await gh<GhMembership[]>(
      '/user/memberships/orgs?state=active&per_page=100',
      parsed.data.githubToken,
    ).catch(() => [] as GhMembership[]);
    const db = c.env.DB;
    const now = Date.now();
    // Upsert por github_id (los logins cambian); si el handle está ocupado por otra cuenta se desambigua.
    const existing = await db
      .prepare('SELECT id, handle FROM accounts WHERE github_id = ?1')
      .bind(user.id)
      .first<{ id: string; handle: string }>();
    const accountId = existing?.id ?? newId('acc');
    const stmts: D1PreparedStatement[] = [];
    if (existing) {
      stmts.push(
        db
          .prepare(
            'UPDATE accounts SET github_login = ?1, avatar_url = ?2, email = ?3, display_name = coalesce(?4, display_name), updated_at = ?5 WHERE id = ?6',
          )
          .bind(user.login, user.avatar_url, user.email, user.name ?? null, now, accountId),
      );
    } else {
      const taken = await db.prepare('SELECT 1 FROM accounts WHERE handle = ?1').bind(user.login).first();
      const handle = taken ? `${user.login}-${user.id}` : user.login;
      stmts.push(
        db
          .prepare(
            "INSERT INTO accounts (id, kind, handle, display_name, avatar_url, email, github_id, github_login, created_at, updated_at) VALUES (?1, 'user', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)",
          )
          .bind(accountId, handle, user.name ?? null, user.avatar_url, user.email, user.id, user.login, now),
      );
    }
    const orgs: string[] = [];
    for (const m of memberships.filter((m) => m.state === 'active')) {
      const org = m.organization;
      const row = await db.prepare('SELECT id FROM accounts WHERE github_id = ?1').bind(org.id).first<{ id: string }>();
      const orgId = row?.id ?? newId('acc');
      if (!row) {
        const taken = await db.prepare('SELECT 1 FROM accounts WHERE handle = ?1').bind(org.login).first();
        stmts.push(
          db
            .prepare(
              "INSERT INTO accounts (id, kind, handle, avatar_url, github_id, github_login, created_at, updated_at) VALUES (?1, 'org', ?2, ?3, ?4, ?5, ?6, ?6)",
            )
            .bind(orgId, taken ? `${org.login}-${org.id}` : org.login, org.avatar_url ?? null, org.id, org.login, now),
        );
      }
      // Admin de la org en GitHub ⇒ admin; miembro ⇒ publisher (ADR-018: solo puede publicar desde repos de la org).
      const role = m.role === 'admin' ? 'admin' : 'publisher';
      stmts.push(
        db
          .prepare(
            "INSERT INTO memberships (org_id, user_id, role, source, synced_at, created_at) VALUES (?1, ?2, ?3, 'github', ?4, ?4) ON CONFLICT (org_id, user_id) DO UPDATE SET role = CASE WHEN memberships.source = 'github' THEN ?3 ELSE memberships.role END, synced_at = ?4",
          )
          .bind(orgId, accountId, role, now),
      );
      orgs.push(org.login);
    }
    const token = newToken();
    const expiresAt = now + CLI_TOKEN_DAYS * 86_400_000;
    const tokenId = newId('tok');
    stmts.push(
      db
        .prepare(
          'INSERT INTO api_tokens (id, account_id, name, token_prefix, token_hash, scopes, expires_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5, \'["read","publish"]\', ?6, ?7)',
        )
        .bind(
          tokenId,
          accountId,
          parsed.data.name ?? 'cli',
          token.slice(0, 8),
          await hashToken(c.env.TOKEN_PEPPER, token),
          expiresAt,
          now,
        ),
    );
    stmts.push(
      db
        .prepare(
          "INSERT INTO audit_log (id, registry_id, actor_id, action, target_type, target_id, ip_hash, created_at) VALUES (?1, ?2, ?3, 'token.create', 'token', ?4, ?5, ?6)",
        )
        .bind(
          newId('aud'),
          c.get('tenant').registryId,
          accountId,
          tokenId,
          c.env.IP_SALT ? await hashIp(c.env.IP_SALT, clientIp(c.req.raw)) : null,
          now,
        ),
    );
    await db.batch(stmts);
    c.header('Cache-Control', 'no-store');
    const handle = (await db
      .prepare('SELECT handle FROM accounts WHERE id = ?1')
      .bind(accountId)
      .first<{ handle: string }>())!.handle;
    return c.json({ token, expiresAt: new Date(expiresAt).toISOString(), account: { handle, orgs } });
  })
  .post('/logout', requireAuth(), async (c) => {
    const actor = c.get('actor')!;
    if (actor.tokenId) {
      await c.env.DB.prepare('UPDATE api_tokens SET revoked_at = ?1 WHERE id = ?2 AND revoked_at IS NULL')
        .bind(Date.now(), actor.tokenId)
        .run();
    }
    return c.json({ ok: true });
  });

export const me = new Hono<AppEnv>().get('/', requireAuth(), async (c) => {
  const actor = c.get('actor')!;
  const db = c.env.DB;
  const account = await db
    .prepare(
      'SELECT id, kind, handle, display_name, avatar_url, github_login, is_verified, locale, created_at FROM accounts WHERE id = ?1',
    )
    .bind(actor.accountId)
    .first<{
      id: string;
      kind: string;
      handle: string;
      display_name: string | null;
      avatar_url: string | null;
      github_login: string | null;
      is_verified: number;
      locale: string | null;
      created_at: number;
    }>();
  const { results: orgs } = await db
    .prepare(
      "SELECT a.handle, m.role FROM memberships m JOIN accounts a ON a.id = m.org_id WHERE m.user_id = ?1 AND a.id != 'acc_system' ORDER BY a.handle",
    )
    .bind(actor.accountId)
    .all<{ handle: string; role: string }>();
  const token = actor.tokenId
    ? await db
        .prepare('SELECT name, token_prefix, scopes, expires_at, created_at FROM api_tokens WHERE id = ?1')
        .bind(actor.tokenId)
        .first<{ name: string; token_prefix: string; scopes: string; expires_at: number | null; created_at: number }>()
    : null;
  return c.json({
    handle: account!.handle,
    kind: account!.kind,
    displayName: account!.display_name,
    avatarUrl: account!.avatar_url,
    github: account!.github_login,
    verified: account!.is_verified === 1,
    locale: account!.locale,
    staff: actor.isStaff,
    orgs,
    token: token
      ? {
          name: token.name,
          prefix: token.token_prefix,
          scopes: JSON.parse(token.scopes) as string[],
          expiresAt: token.expires_at ? new Date(token.expires_at).toISOString() : null,
        }
      : null,
  });
});
