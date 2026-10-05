// SSO por organización con OIDC (V10-02, ADR-030). La identidad de GenPM sigue siendo GitHub: el SSO vincula esa cuenta
// con la del IdP de la empresa, da de alta en la org (JIT) y, con `enforce`, es condición para el acceso que viene de
// la org (registros privados). SCIM (ENT-02) desactiva identidades.
//   GET/PUT/DELETE /v1/orgs/:org/sso                 configuración (owner/admin de la org)
//   DELETE        /v1/orgs/:org/sso/identities/:h   desvincular a alguien
//   POST          /v1/auth/sso/:org/start           URL de autorización (PKCE + nonce en un state cifrado)
//   POST          /v1/auth/sso/callback             canje del code, verificación del id_token y vinculación

import { bytesToBase64Url } from '@genpm/manifest';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../env.js';
import { httpError } from '../http.js';
import { newId } from '../ids.js';
import { requireAuth } from '../middleware/auth.js';
import { verifyIdToken } from '../services/oidc.js';
import { open, seal } from '../services/secretbox.js';
import { hashToken, newToken } from '../services/tokens.js';

export type SsoConfig = {
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  jwksUri: string;
  clientId: string;
  clientSecretEnc: string;
  domains: string[];
  enforce: boolean;
};

const STATE_TTL = 10 * 60_000;

/** Solo https y nunca hosts internos (SSRF, security §5). */
function safeUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[|0\.)/.test(u.hostname)) return null;
    if (u.hostname.endsWith('.internal')) return null;
    return u.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

async function orgAdmin(c: Context<AppEnv>, admin: boolean) {
  const handle = c.req.param('org') ?? '';
  const org = await c.env.DB.prepare("SELECT id, handle FROM accounts WHERE handle = ?1 AND kind = 'org'")
    .bind(handle)
    .first<{ id: string; handle: string }>();
  const m = org
    ? await c.env.DB.prepare('SELECT role FROM memberships WHERE org_id = ?1 AND user_id = ?2')
        .bind(org.id, c.get('actor')!.accountId)
        .first<{ role: string }>()
    : null;
  if (!org || !m) throw httpError('E_NOT_FOUND', { name: handle });
  if (admin && m.role !== 'owner' && m.role !== 'admin') throw httpError('E_FORBIDDEN_SCOPE', { scope: org.handle });
  return org;
}

async function connectionOf(db: D1Database, orgId: string) {
  const row = await db
    .prepare("SELECT id, config FROM sso_connections WHERE org_id = ?1 AND protocol = 'oidc'")
    .bind(orgId)
    .first<{ id: string; config: string }>();
  return row ? { id: row.id, config: JSON.parse(row.config) as SsoConfig } : null;
}

function audit(c: Context<AppEnv>, action: string, id: string, meta: Record<string, unknown>) {
  return c.env.DB.prepare(
    "INSERT INTO audit_log (id, registry_id, actor_id, action, target_type, target_id, metadata, created_at) VALUES (?1, ?2, ?3, ?4, 'org', ?5, ?6, ?7)",
  ).bind(
    newId('aud'),
    c.get('tenant').registryId,
    c.get('actor')!.accountId,
    action,
    id,
    JSON.stringify(meta),
    Date.now(),
  );
}

const Config = z.strictObject({
  issuer: z.string().max(300),
  clientId: z.string().min(1).max(300),
  clientSecret: z.string().min(1).max(500).optional(),
  domains: z
    .array(
      z
        .string()
        .toLowerCase()
        .regex(/^(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/),
    )
    .max(20)
    .default([]),
  enforce: z.boolean().default(false),
});

export const sso = new Hono<AppEnv>()
  .use('*', requireAuth())
  .get('/:org/sso', async (c) => {
    const org = await orgAdmin(c, false);
    const conn = await connectionOf(c.env.DB, org.id);
    const me = conn
      ? await c.env.DB.prepare(
          'SELECT email, active, last_auth_at FROM sso_identities WHERE connection_id = ?1 AND account_id = ?2',
        )
          .bind(conn.id, c.get('actor')!.accountId)
          .first<{ email: string | null; active: number; last_auth_at: number | null }>()
      : null;
    if (!conn) return c.json({ org: org.handle, enabled: false });
    const { clientSecretEnc: _s, ...pub } = conn.config;
    return c.json({
      org: org.handle,
      enabled: true,
      ...pub,
      linked: me ? { email: me.email, active: me.active === 1, lastAuthAt: me.last_auth_at } : null,
    });
  })
  .put('/:org/sso', requireAuth('publish'), async (c) => {
    const org = await orgAdmin(c, true);
    const body = Config.safeParse(await c.req.json().catch(() => null));
    if (!body.success) throw httpError('E_BAD_REQUEST', { detail: body.error.issues[0]?.path.join('.') ?? 'body' });
    const issuer = safeUrl(body.data.issuer);
    if (!issuer) throw httpError('E_BAD_REQUEST', { detail: 'issuer' });
    // Descubrimiento OIDC: los endpoints vienen del IdP y también tienen que ser https públicos.
    const res = await fetch(`${issuer}/.well-known/openid-configuration`, { redirect: 'manual' }).catch(() => null);
    const d = (res?.ok ? await res.json().catch(() => null) : null) as Record<string, unknown> | null;
    const ep = {
      authorizationEndpoint: safeUrl(d?.['authorization_endpoint']),
      tokenEndpoint: safeUrl(d?.['token_endpoint']),
      jwksUri: safeUrl(d?.['jwks_uri']),
    };
    if (!d || safeUrl(d['issuer']) !== issuer || !ep.authorizationEndpoint || !ep.tokenEndpoint || !ep.jwksUri)
      throw httpError('E_BAD_REQUEST', { detail: 'issuer discovery' });
    const prev = await connectionOf(c.env.DB, org.id);
    const secret = body.data.clientSecret
      ? await seal(c.env.TOKEN_PEPPER!, 'genpm-sso-client', body.data.clientSecret)
      : prev?.config.clientSecretEnc;
    if (!secret) throw httpError('E_BAD_REQUEST', { detail: 'clientSecret' });
    const config: SsoConfig = {
      issuer,
      authorizationEndpoint: ep.authorizationEndpoint,
      tokenEndpoint: ep.tokenEndpoint,
      jwksUri: ep.jwksUri,
      clientId: body.data.clientId,
      clientSecretEnc: secret,
      domains: body.data.domains,
      enforce: body.data.enforce,
    };
    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO sso_connections (id, org_id, protocol, config, created_at) VALUES (?1, ?2, 'oidc', ?3, ?4)
         ON CONFLICT (org_id) DO UPDATE SET config = ?3`,
      ).bind(prev?.id ?? newId('sso'), org.id, JSON.stringify(config), Date.now()),
      audit(c, 'org.sso', org.id, { issuer, domains: config.domains, enforce: config.enforce }),
    ]);
    return c.json({ ok: true, org: org.handle, issuer, enforce: config.enforce });
  })
  .delete('/:org/sso', requireAuth('publish'), async (c) => {
    const org = await orgAdmin(c, true);
    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM sso_connections WHERE org_id = ?1').bind(org.id),
      audit(c, 'org.sso_remove', org.id, {}),
    ]);
    return c.json({ ok: true });
  })
  // SCIM (ENT-02): token para el IdP, mostrado una vez; solo se guarda su hash.
  .post('/:org/sso/scim-token', requireAuth('publish'), async (c) => {
    const org = await orgAdmin(c, true);
    const conn = await connectionOf(c.env.DB, org.id);
    if (!conn) throw httpError('E_NOT_FOUND', { name: 'sso' });
    const token = newToken();
    await c.env.DB.batch([
      c.env.DB.prepare(
        "UPDATE sso_connections SET config = json_set(config, '$.scimTokenHash', ?1) WHERE id = ?2",
      ).bind(await hashToken(c.env.TOKEN_PEPPER!, token), conn.id),
      audit(c, 'org.scim_token', org.id, {}),
    ]);
    return c.json({ token, baseUrl: `${new URL(c.req.url).origin}/scim/v2/${org.handle}` }, 201);
  })
  .delete('/:org/sso/identities/:handle', requireAuth('publish'), async (c) => {
    const org = await orgAdmin(c, true);
    const conn = await connectionOf(c.env.DB, org.id);
    const r = conn
      ? await c.env.DB.prepare(
          'UPDATE sso_identities SET active = 0 WHERE connection_id = ?1 AND account_id = (SELECT id FROM accounts WHERE handle = ?2)',
        )
          .bind(conn.id, c.req.param('handle'))
          .run()
      : null;
    if (!r?.meta.changes) throw httpError('E_NOT_FOUND', { name: c.req.param('handle') });
    await audit(c, 'org.sso_deactivate', org.id, { handle: c.req.param('handle') }).run();
    return c.json({ ok: true });
  });

const b64 = (bytes: Uint8Array) => bytesToBase64Url(bytes);
const rand = () => b64(crypto.getRandomValues(new Uint8Array(32)));
async function s256(v: string) {
  return b64(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v))));
}

type State = { org: string; acc: string; nonce: string; verifier: string; redirectUri: string; exp: number };

export const ssoAuth = new Hono<AppEnv>()
  .post('/sso/:org/start', requireAuth(), async (c) => {
    const body = z.strictObject({ redirectUri: z.string().max(300) }).safeParse(await c.req.json().catch(() => null));
    // Solo se vuelve a la web propia: nada de redirecciones abiertas.
    if (!body.success || body.data.redirectUri !== `${c.env.WEB_ORIGIN}/auth/sso/callback`)
      throw httpError('E_BAD_REQUEST', { detail: 'redirectUri' });
    const org = await c.env.DB.prepare("SELECT id, handle FROM accounts WHERE handle = ?1 AND kind = 'org'")
      .bind(c.req.param('org'))
      .first<{ id: string; handle: string }>();
    const conn = org ? await connectionOf(c.env.DB, org.id) : null;
    if (!org || !conn) throw httpError('E_NOT_FOUND', { name: c.req.param('org') });
    const st: State = {
      org: org.id,
      acc: c.get('actor')!.accountId,
      nonce: rand(),
      verifier: rand(),
      redirectUri: body.data.redirectUri,
      exp: Date.now() + STATE_TTL,
    };
    const url = new URL(conn.config.authorizationEndpoint);
    url.search = new URLSearchParams({
      response_type: 'code',
      client_id: conn.config.clientId,
      redirect_uri: st.redirectUri,
      scope: 'openid email profile',
      state: await seal(c.env.TOKEN_PEPPER!, 'genpm-sso-state', JSON.stringify(st)),
      nonce: st.nonce,
      code_challenge: await s256(st.verifier),
      code_challenge_method: 'S256',
    }).toString();
    return c.json({ url: url.toString() });
  })
  .post('/sso/callback', requireAuth(), async (c) => {
    const body = z
      .strictObject({ code: z.string().min(1).max(2000), state: z.string().min(1).max(4000) })
      .safeParse(await c.req.json().catch(() => null));
    if (!body.success) throw httpError('E_BAD_REQUEST', { detail: 'code' });
    const raw = await open(c.env.TOKEN_PEPPER!, 'genpm-sso-state', body.data.state);
    const st = raw ? (JSON.parse(raw) as State) : null;
    // El state es de esta cuenta y reciente: no se puede reutilizar el de otra persona.
    if (!st || st.exp < Date.now() || st.acc !== c.get('actor')!.accountId) throw httpError('E_AUTH');
    const conn = await connectionOf(c.env.DB, st.org);
    const secret = conn ? await open(c.env.TOKEN_PEPPER!, 'genpm-sso-client', conn.config.clientSecretEnc) : null;
    if (!conn || !secret) throw httpError('E_AUTH');
    const tok = await fetch(conn.config.tokenEndpoint, {
      method: 'POST',
      redirect: 'manual',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: body.data.code,
        redirect_uri: st.redirectUri,
        client_id: conn.config.clientId,
        client_secret: secret,
        code_verifier: st.verifier,
      }),
    }).catch(() => null);
    const idToken = tok?.ok ? ((await tok.json().catch(() => ({}))) as { id_token?: string }).id_token : undefined;
    const claims = idToken
      ? await verifyIdToken(idToken, {
          issuer: conn.config.issuer,
          jwksUri: conn.config.jwksUri,
          clientId: conn.config.clientId,
          nonce: st.nonce,
        })
      : null;
    if (!claims) throw httpError('E_AUTH');
    const email = claims.email?.toLowerCase() ?? null;
    if (
      conn.config.domains.length &&
      (!email || claims.email_verified === false || !conn.config.domains.some((d) => email.endsWith(`@${d}`)))
    )
      throw httpError('E_FORBIDDEN_SCOPE', { scope: email ?? 'email' });
    // Identidad dada de alta por SCIM (ENT-02) y aún sin vincular: se reconoce por el email y pasa a usar el `sub`.
    if (email)
      await c.env.DB.prepare(
        `UPDATE sso_identities SET subject = ?3 WHERE connection_id = ?1 AND email = ?2 AND scim_id IS NOT NULL
           AND account_id IS NULL AND subject != ?3
           AND NOT EXISTS (SELECT 1 FROM sso_identities x WHERE x.connection_id = ?1 AND x.subject = ?3)`,
      )
        .bind(conn.id, email, claims.sub)
        .run();
    const owner = await c.env.DB.prepare(
      'SELECT account_id, active FROM sso_identities WHERE connection_id = ?1 AND subject = ?2',
    )
      .bind(conn.id, claims.sub)
      .first<{ account_id: string | null; active: number }>();
    const acc = c.get('actor')!.accountId;
    // Una identidad del IdP solo se vincula a una cuenta; desactivada por SCIM o el admin, no vuelve sola.
    if (owner && ((owner.account_id && owner.account_id !== acc) || owner.active === 0))
      throw httpError('E_FORBIDDEN_SCOPE', { scope: 'sso' });
    const now = Date.now();
    await c.env.DB.batch([
      c.env.DB.prepare(
        'DELETE FROM sso_identities WHERE connection_id = ?1 AND account_id = ?2 AND subject != ?3',
      ).bind(conn.id, acc, claims.sub),
      c.env.DB.prepare(
        `INSERT INTO sso_identities (connection_id, subject, account_id, email, active, last_auth_at, created_at)
         VALUES (?1, ?2, ?3, ?4, 1, ?5, ?5)
         ON CONFLICT (connection_id, subject) DO UPDATE SET account_id = ?3, email = ?4, last_auth_at = ?5`,
      ).bind(conn.id, claims.sub, acc, email, now),
      // Alta automática (JIT) como miembro; nunca rebaja un rol existente.
      c.env.DB.prepare(
        "INSERT OR IGNORE INTO memberships (org_id, user_id, role, source, synced_at, created_at) VALUES (?1, ?2, 'member', 'sso', ?3, ?3)",
      ).bind(st.org, acc, now),
      audit(c, 'org.sso_login', st.org, { email }),
    ]);
    const org = await c.env.DB.prepare('SELECT handle FROM accounts WHERE id = ?1')
      .bind(st.org)
      .first<{ handle: string }>();
    return c.json({ ok: true, org: org?.handle ?? null, email });
  });
