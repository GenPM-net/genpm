// Autenticación por `Authorization: Bearer gpm_…` o cookie web `__Host-genpm_session` (api-spec §1, security §5).
import type { Context, MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import type { Actor, AppEnv } from '../env.js';
import { httpError } from '../http.js';
import { hashToken, isWellFormedToken } from '../services/tokens.js';

type TokenRow = {
  id: string;
  account_id: string;
  scopes: string;
  expires_at: number | null;
  revoked_at: number | null;
  handle: string;
  status: string;
  is_staff: number;
  name: string;
  allowed_packages: string | null;
  repository: string | null;
};

/** ¿Puede este token actuar sobre el paquete? (`allowed_packages` admite `@scope/*`). */
export function tokenAllows(actor: Actor, name: string): boolean {
  const list = actor.allowedPackages;
  if (!list) return true;
  const scope = name.split('/')[0];
  return list.some((p) => p === name || p === `${scope}/*`);
}

export async function actorFromRequest(c: Context<AppEnv>): Promise<Actor | null> {
  const pepper = c.env.TOKEN_PEPPER;
  if (!pepper) return null;
  const header = c.req.header('authorization');
  if (header) {
    const token = header.replace(/^Bearer\s+/i, '').trim();
    if (!isWellFormedToken(token)) throw httpError('E_AUTH');
    const row = await c.env.DB.prepare(
      `SELECT t.id, t.account_id, t.scopes, t.name, t.expires_at, t.revoked_at, t.allowed_packages, t.repository, a.handle, a.status, a.is_staff
       FROM api_tokens t JOIN accounts a ON a.id = t.account_id WHERE t.token_hash = ?1`,
    )
      .bind(await hashToken(pepper, token))
      .first<TokenRow>();
    const now = Date.now();
    if (
      !row ||
      row.revoked_at !== null ||
      (row.expires_at !== null && row.expires_at < now) ||
      row.status !== 'active'
    ) {
      throw httpError('E_AUTH');
    }
    c.executionCtx.waitUntil(
      c.env.DB.prepare('UPDATE api_tokens SET last_used_at = ?1 WHERE id = ?2').bind(now, row.id).run(),
    );
    return {
      accountId: row.account_id,
      handle: row.handle,
      // Los tokens de sesión web (name = 'web') también gestionan tokens desde /settings/tokens.
      scopes: [...(JSON.parse(row.scopes) as string[]), ...(row.name === 'web' ? ['web'] : [])],
      tokenId: row.id,
      isStaff: row.is_staff === 1,
      allowedPackages: row.allowed_packages ? (JSON.parse(row.allowed_packages) as string[]) : null,
      repository: row.repository,
    };
  }
  const session = getCookie(c, '__Host-genpm_session');
  if (session) {
    const row = await c.env.DB.prepare(
      `SELECT s.account_id, a.handle, a.status, a.is_staff FROM sessions s JOIN accounts a ON a.id = s.account_id
       WHERE s.id = ?1 AND s.expires_at > ?2`,
    )
      .bind(await hashToken(pepper, session), Date.now())
      .first<{ account_id: string; handle: string; status: string; is_staff: number }>();
    if (row && row.status === 'active') {
      return {
        accountId: row.account_id,
        handle: row.handle,
        scopes: ['read', 'publish', 'web'],
        tokenId: null,
        isStaff: row.is_staff === 1,
      };
    }
  }
  return null;
}

/** Exige un actor con el scope indicado (`read` | `publish` | `web` | `admin`). */
export function requireAuth(scope?: string): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const actor = await actorFromRequest(c);
    if (!actor) throw httpError('E_AUTH');
    if (scope && !actor.scopes.includes(scope)) throw httpError('E_AUTH');
    c.set('actor', actor);
    c.header('Cache-Control', 'private, no-store');
    await next();
  };
}
