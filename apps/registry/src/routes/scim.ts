// SCIM 2.0 (ENT-02, RFC 7643/7644) por organización: `/scim/v2/:org/Users`. El IdP (Okta, Entra ID…) crea, actualiza
// y desactiva identidades de la conexión SSO de la org (V10-02). Desactivar o borrar pone `active = 0` y quita la
// membresía que dio el SSO: con `enforce`, el acceso a los registros privados se corta al momento. Autenticación:
// token SCIM de la org (`POST /v1/orgs/:org/sso/scim-token`), guardado solo como hash.

import type { Context } from 'hono';
import { Hono } from 'hono';
import type { AppEnv } from '../env.js';
import { newId } from '../ids.js';
import { hashToken, isWellFormedToken } from '../services/tokens.js';

const SCHEMA_USER = 'urn:ietf:params:scim:schemas:core:2.0:User';
const SCHEMA_LIST = 'urn:ietf:params:scim:api:messages:2.0:ListResponse';
const SCHEMA_ERROR = 'urn:ietf:params:scim:api:messages:2.0:Error';
const SCHEMA_PATCH = 'urn:ietf:params:scim:api:messages:2.0:PatchOp';

type Conn = { id: string; orgId: string };
type Row = {
  scim_id: string;
  subject: string;
  email: string | null;
  active: number;
  account_id: string | null;
  created_at: number;
};

const scimJson = (c: Context<AppEnv>, body: unknown, status = 200) =>
  c.body(JSON.stringify(body), status as 200, { 'Content-Type': 'application/scim+json', 'Cache-Control': 'no-store' });
const scimError = (c: Context<AppEnv>, status: number, detail: string) =>
  scimJson(c, { schemas: [SCHEMA_ERROR], status: String(status), detail }, status);

async function connection(c: Context<AppEnv>): Promise<Conn | null> {
  const token = (c.req.header('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!isWellFormedToken(token) || !c.env.TOKEN_PEPPER) return null;
  const row = await c.env.DB.prepare(
    `SELECT s.id, s.org_id, json_extract(s.config, '$.scimTokenHash') AS h FROM sso_connections s
     JOIN accounts a ON a.id = s.org_id WHERE a.handle = ?1`,
  )
    .bind(c.req.param('org') ?? '')
    .first<{ id: string; org_id: string; h: string | null }>();
  if (!row?.h || row.h !== (await hashToken(c.env.TOKEN_PEPPER, token))) return null;
  return { id: row.id, orgId: row.org_id };
}

function user(r: Row, base: string) {
  return {
    schemas: [SCHEMA_USER],
    id: r.scim_id,
    userName: r.email ?? r.subject,
    active: r.active === 1,
    emails: r.email ? [{ value: r.email, primary: true }] : [],
    meta: {
      resourceType: 'User',
      created: new Date(r.created_at).toISOString(),
      location: `${base}/Users/${r.scim_id}`,
    },
  };
}

async function setActive(c: Context<AppEnv>, conn: Conn, scimId: string, active: boolean) {
  const row = await c.env.DB.prepare('SELECT account_id FROM sso_identities WHERE connection_id = ?1 AND scim_id = ?2')
    .bind(conn.id, scimId)
    .first<{ account_id: string | null }>();
  if (!row) return false;
  const stmts = [
    c.env.DB.prepare('UPDATE sso_identities SET active = ?1 WHERE connection_id = ?2 AND scim_id = ?3').bind(
      active ? 1 : 0,
      conn.id,
      scimId,
    ),
    c.env.DB.prepare(
      "INSERT INTO audit_log (id, registry_id, actor_id, action, target_type, target_id, metadata, created_at) VALUES (?1, 'reg_public', NULL, ?2, 'org', ?3, ?4, ?5)",
    ).bind(
      newId('aud'),
      active ? 'org.scim_activate' : 'org.scim_deactivate',
      conn.orgId,
      JSON.stringify({ scimId }),
      Date.now(),
    ),
  ];
  // La baja quita la membresía que dio el SSO (no las que vienen de GitHub o se dieron a mano).
  if (!active && row.account_id)
    stmts.push(
      c.env.DB.prepare("DELETE FROM memberships WHERE org_id = ?1 AND user_id = ?2 AND source IN ('sso', 'scim')").bind(
        conn.orgId,
        row.account_id,
      ),
    );
  await c.env.DB.batch(stmts);
  return true;
}

const SELECT = 'SELECT scim_id, subject, email, active, account_id, created_at FROM sso_identities';

export const scim = new Hono<AppEnv>()
  .get('/:org/ServiceProviderConfig', async (c) => {
    if (!(await connection(c))) return scimError(c, 401, 'Invalid SCIM token');
    return scimJson(c, {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
      patch: { supported: true },
      bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
      filter: { supported: true, maxResults: 100 },
      changePassword: { supported: false },
      sort: { supported: false },
      etag: { supported: false },
      authenticationSchemes: [
        { type: 'oauthbearertoken', name: 'OAuth Bearer Token', description: 'GenPM SCIM token' },
      ],
    });
  })
  .get('/:org/Users', async (c) => {
    const conn = await connection(c);
    if (!conn) return scimError(c, 401, 'Invalid SCIM token');
    const base = `${new URL(c.req.url).origin}/scim/v2/${c.req.param('org')}`;
    const filter = c.req.query('filter') ?? '';
    const eq = filter.match(/^userName eq "([^"]{1,320})"$/i);
    if (filter && !eq) return scimError(c, 400, 'Only userName eq filters are supported');
    const start = Math.max(1, Number(c.req.query('startIndex') ?? 1) || 1);
    const count = Math.min(100, Math.max(0, Number(c.req.query('count') ?? 100) || 100));
    const { results } = eq
      ? await c.env.DB.prepare(
          `${SELECT} WHERE connection_id = ?1 AND scim_id IS NOT NULL AND (email = ?2 OR subject = ?2)`,
        )
          .bind(conn.id, eq[1]!.toLowerCase())
          .all<Row>()
      : await c.env.DB.prepare(
          `${SELECT} WHERE connection_id = ?1 AND scim_id IS NOT NULL ORDER BY created_at LIMIT ?2 OFFSET ?3`,
        )
          .bind(conn.id, count, start - 1)
          .all<Row>();
    const total = eq
      ? results.length
      : ((
          await c.env.DB.prepare(
            'SELECT count(*) AS n FROM sso_identities WHERE connection_id = ?1 AND scim_id IS NOT NULL',
          )
            .bind(conn.id)
            .first<{ n: number }>()
        )?.n ?? 0);
    return scimJson(c, {
      schemas: [SCHEMA_LIST],
      totalResults: total,
      startIndex: start,
      itemsPerPage: results.length,
      Resources: results.map((r) => user(r, base)),
    });
  })
  .post('/:org/Users', async (c) => {
    const conn = await connection(c);
    if (!conn) return scimError(c, 401, 'Invalid SCIM token');
    const body = (await c.req.json().catch(() => null)) as {
      userName?: string;
      active?: boolean;
      emails?: Array<{ value?: string; primary?: boolean }>;
    } | null;
    const userName = body?.userName?.trim().toLowerCase();
    if (!userName || userName.length > 320) return scimError(c, 400, 'userName is required');
    const email =
      (
        body?.emails?.find((e) => e.primary)?.value ??
        body?.emails?.[0]?.value ??
        (userName.includes('@') ? userName : null)
      )?.toLowerCase() ?? null;
    const exists = await c.env.DB.prepare(
      'SELECT 1 AS x FROM sso_identities WHERE connection_id = ?1 AND (subject = ?2 OR email = ?3)',
    )
      .bind(conn.id, userName, email ?? userName)
      .first();
    if (exists)
      return scimJson(
        c,
        { schemas: [SCHEMA_ERROR], status: '409', scimType: 'uniqueness', detail: 'User exists' },
        409,
      );
    const id = crypto.randomUUID();
    const now = Date.now();
    await c.env.DB.prepare(
      `INSERT INTO sso_identities (connection_id, subject, account_id, email, active, scim_id, created_at)
       VALUES (?1, ?2, NULL, ?3, ?4, ?5, ?6)`,
    )
      .bind(conn.id, userName, email, body?.active === false ? 0 : 1, id, now)
      .run();
    const row = (await c.env.DB.prepare(`${SELECT} WHERE connection_id = ?1 AND scim_id = ?2`)
      .bind(conn.id, id)
      .first<Row>())!;
    return scimJson(c, user(row, `${new URL(c.req.url).origin}/scim/v2/${c.req.param('org')}`), 201);
  })
  .get('/:org/Users/:id', async (c) => {
    const conn = await connection(c);
    if (!conn) return scimError(c, 401, 'Invalid SCIM token');
    const row = await c.env.DB.prepare(`${SELECT} WHERE connection_id = ?1 AND scim_id = ?2`)
      .bind(conn.id, c.req.param('id'))
      .first<Row>();
    if (!row) return scimError(c, 404, 'User not found');
    return scimJson(c, user(row, `${new URL(c.req.url).origin}/scim/v2/${c.req.param('org')}`));
  })
  // PUT (reemplazo) y PATCH (Okta/Entra mandan `active`): solo `active` cambia el acceso; el email se actualiza.
  .on(['PUT', 'PATCH'], '/:org/Users/:id', async (c) => {
    const conn = await connection(c);
    if (!conn) return scimError(c, 401, 'Invalid SCIM token');
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return scimError(c, 400, 'Invalid body');
    let active: boolean | undefined;
    if (c.req.method === 'PUT') active = body['active'] === undefined ? undefined : body['active'] !== false;
    else {
      const ops = Array.isArray(body['Operations']) ? (body['Operations'] as Array<Record<string, unknown>>) : [];
      if (!(body['schemas'] as string[] | undefined)?.includes(SCHEMA_PATCH))
        return scimError(c, 400, 'PatchOp schema required');
      for (const op of ops) {
        const v = op['value'];
        if (String(op['path'] ?? '').toLowerCase() === 'active') active = v === true || v === 'True' || v === 'true';
        else if (v && typeof v === 'object' && 'active' in (v as object))
          active = (v as { active: unknown }).active !== false;
      }
    }
    const id = c.req.param('id') ?? '';
    if (active !== undefined && !(await setActive(c, conn, id, active))) return scimError(c, 404, 'User not found');
    const row = await c.env.DB.prepare(`${SELECT} WHERE connection_id = ?1 AND scim_id = ?2`)
      .bind(conn.id, id)
      .first<Row>();
    if (!row) return scimError(c, 404, 'User not found');
    return scimJson(c, user(row, `${new URL(c.req.url).origin}/scim/v2/${c.req.param('org')}`));
  })
  .delete('/:org/Users/:id', async (c) => {
    const conn = await connection(c);
    if (!conn) return scimError(c, 401, 'Invalid SCIM token');
    const id = c.req.param('id') ?? '';
    if (!(await setActive(c, conn, id, false))) return scimError(c, 404, 'User not found');
    // Se conserva la fila desactivada: una identidad dada de baja no puede volver a vincularse por SSO sola.
    return c.body(null, 204);
  });
