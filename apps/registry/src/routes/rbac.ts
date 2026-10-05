// Registros privados con RBAC (V10-01, api-spec §5.4):
//   /v1/registries                      crear y listar registros privados; miembros (cuentas u orgs) con rol
//   /v1/orgs/:org/teams                 equipos de una org y sus miembros
//   /v1/packages/:scope/:name/access    visibilidad y grants por paquete (solo en registros privados)
// Sin permiso ⇒ 404 (no revelar existencia). Toda escritura deja rastro en audit_log.

import { PolicySchema } from '@genpm/manifest';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { z } from 'zod';
import type { Actor, AppEnv } from '../env.js';
import { httpError } from '../http.js';
import { newId } from '../ids.js';
import { requireAuth } from '../middleware/auth.js';
import { BINDING_HOST } from '../middleware/rate-limit.js';
import { atLeast, grantOf, type RegistryRole, registryRole } from '../services/access.js';
import {
  addCustomHostname,
  CNAME_TARGET,
  challengeName,
  DOMAIN_RE,
  isOwnHost,
  removeCustomHostname,
  verifyTxt,
} from '../services/domains.js';
import { newToken } from '../services/tokens.js';
import { fullName, repoOf } from './util.js';

/** Subdominios y rutas que nunca pueden ser el slug de un registro. */
const RESERVED = new Set(['public', 'www', 'api', 'mcp', 'staging', 'admin', 'app', 'docs', 'status', 'genpm', 'r']);
const SLUG = /^[a-z0-9][a-z0-9-]{1,38}$/;

function audit(c: Context<AppEnv>, action: string, type: string, id: string, meta: Record<string, unknown>) {
  return c.env.DB.prepare(
    'INSERT INTO audit_log (id, registry_id, actor_id, action, target_type, target_id, metadata, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)',
  ).bind(
    newId('aud'),
    c.get('tenant').registryId,
    c.get('actor')!.accountId,
    action,
    type,
    id,
    JSON.stringify(meta),
    Date.now(),
  );
}

async function orgRole(db: D1Database, orgId: string, accountId: string): Promise<string | null> {
  if (orgId === accountId) return 'owner';
  const m = await db
    .prepare('SELECT role FROM memberships WHERE org_id = ?1 AND user_id = ?2')
    .bind(orgId, accountId)
    .first<{ role: string }>();
  return m?.role ?? null;
}

const isOrgAdmin = (role: string | null) => role === 'owner' || role === 'admin';

async function accountByHandle(db: D1Database, handle: string) {
  return db
    .prepare("SELECT id, handle, kind FROM accounts WHERE handle = ?1 AND status = 'active'")
    .bind(handle.replace(/^@/, ''))
    .first<{ id: string; handle: string; kind: 'user' | 'org' }>();
}

type RegistryRow = {
  id: string;
  slug: string;
  owner_id: string | null;
  plan: string;
  custom_domain: string | null;
  created_at: number;
};

async function registryFor(c: Context<AppEnv>, need: RegistryRole): Promise<RegistryRow & { role: RegistryRole }> {
  const slug = c.req.param('slug') ?? '';
  const row = await c.env.DB.prepare(
    'SELECT id, slug, owner_id, plan, custom_domain, created_at FROM registries WHERE slug = ?1 AND is_public = 0',
  )
    .bind(slug)
    .first<RegistryRow>();
  const role = row ? await registryRole(c.env.DB, row, c.get('actor')!.accountId) : null;
  if (!row || !role) throw httpError('E_NOT_FOUND', { name: slug });
  if (!atLeast(role, need)) throw httpError('E_FORBIDDEN_SCOPE', { scope: slug });
  return { ...row, role };
}

const view = (r: RegistryRow, role: RegistryRole, origin: string) => ({
  slug: r.slug,
  plan: r.plan,
  role,
  customDomain: r.custom_domain,
  // URL que va en `.genpmrc` (`scopes` o `registry`) y en `genpm login --registry`.
  url: r.custom_domain ? `https://${r.custom_domain}` : `${origin}/r/${r.slug}`,
  createdAt: new Date(r.created_at).toISOString(),
});

/** Origen público del API (la web llama por Service Binding con un host interno). */
const apiOrigin = (c: Context<AppEnv>) => {
  const url = new URL(c.req.url);
  return url.hostname === BINDING_HOST ? `https://api.${new URL(c.env.WEB_ORIGIN).host}` : url.origin;
};

export const registries = new Hono<AppEnv>()
  .use('*', requireAuth())
  .get('/', async (c) => {
    const actor = c.get('actor')!;
    const { results } = await c.env.DB.prepare(
      `SELECT r.id, r.slug, r.owner_id, r.plan, r.custom_domain, r.created_at FROM registries r
       WHERE r.is_public = 0 AND (
         r.owner_id = ?1
         OR r.owner_id IN (SELECT org_id FROM memberships WHERE user_id = ?1)
         OR r.id IN (SELECT registry_id FROM registry_members WHERE account_id = ?1
                       OR account_id IN (SELECT org_id FROM memberships WHERE user_id = ?1)))
       ORDER BY r.slug`,
    )
      .bind(actor.accountId)
      .all<RegistryRow>();
    const out = [];
    for (const r of results) {
      const role = await registryRole(c.env.DB, r, actor.accountId);
      if (role) out.push(view(r, role, apiOrigin(c)));
    }
    return c.json({ registries: out });
  })
  .post('/', requireAuth('publish'), async (c) => {
    const body = z
      .strictObject({ slug: z.string().regex(SLUG), owner: z.string().min(1).max(40) })
      .safeParse(await c.req.json().catch(() => null));
    if (!body.success) throw httpError('E_BAD_REQUEST', { detail: body.error.issues[0]?.path.join('.') ?? 'body' });
    const { slug } = body.data;
    if (RESERVED.has(slug)) throw httpError('E_BAD_REQUEST', { detail: 'slug' });
    const actor = c.get('actor')!;
    const owner = await accountByHandle(c.env.DB, body.data.owner);
    // Dueño: tu propia cuenta o una org donde eres owner/admin.
    if (!owner || !isOrgAdmin(await orgRole(c.env.DB, owner.id, actor.accountId)))
      throw httpError('E_FORBIDDEN_SCOPE', { scope: body.data.owner });
    const id = newId('reg');
    const now = Date.now();
    try {
      await c.env.DB.batch([
        c.env.DB.prepare(
          "INSERT INTO registries (id, slug, owner_id, plan, is_public, isolation, created_at) VALUES (?1, ?2, ?3, 'free', 0, 'shared', ?4)",
        ).bind(id, slug, owner.id, now),
        c.env.DB.prepare(
          'INSERT INTO audit_log (id, registry_id, actor_id, action, target_type, target_id, metadata, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)',
        ).bind(
          newId('aud'),
          id,
          actor.accountId,
          'registry.create',
          'registry',
          id,
          JSON.stringify({ slug, owner: owner.handle }),
          now,
        ),
      ]);
    } catch (e) {
      if (String(e).includes('UNIQUE')) throw httpError('E_BAD_REQUEST', { detail: 'slug taken' });
      throw e;
    }
    const row = { id, slug, owner_id: owner.id, plan: 'free', custom_domain: null, created_at: now };
    return c.json(view(row, 'admin', apiOrigin(c)), 201);
  })
  .get('/:slug', async (c) => {
    const r = await registryFor(c, 'reader');
    const members = atLeast(r.role, 'admin')
      ? (
          await c.env.DB.prepare(
            `SELECT a.handle, a.kind, m.role FROM registry_members m JOIN accounts a ON a.id = m.account_id
             WHERE m.registry_id = ?1 ORDER BY a.handle`,
          )
            .bind(r.id)
            .all<{ handle: string; kind: string; role: string }>()
        ).results
      : undefined;
    const owner = await c.env.DB.prepare('SELECT handle FROM accounts WHERE id = ?1')
      .bind(r.owner_id ?? '')
      .first<{ handle: string }>();
    return c.json({ ...view(r, r.role, apiOrigin(c)), owner: owner?.handle ?? null, members });
  })
  .put('/:slug/members/:handle', requireAuth('publish'), async (c) => {
    const r = await registryFor(c, 'admin');
    const body = z
      .strictObject({ role: z.enum(['admin', 'publisher', 'reader']) })
      .safeParse(await c.req.json().catch(() => null));
    if (!body.success) throw httpError('E_BAD_REQUEST', { detail: 'role' });
    const who = await accountByHandle(c.env.DB, c.req.param('handle'));
    if (!who) throw httpError('E_NOT_FOUND', { name: c.req.param('handle') });
    c.set('tenant', { registryId: r.id, slug: r.slug });
    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO registry_members (registry_id, account_id, role, created_at) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT (registry_id, account_id) DO UPDATE SET role = ?3`,
      ).bind(r.id, who.id, body.data.role, Date.now()),
      audit(c, 'registry.member', 'account', who.id, { handle: who.handle, role: body.data.role }),
    ]);
    return c.json({ ok: true, handle: who.handle, kind: who.kind, role: body.data.role });
  })
  // Políticas (ENT-03): las aplica el registry al publicar aquí y el CLI/MCP en todo proyecto con `policy=` en .genpmrc.
  .put('/:slug/policy', requireAuth('publish'), async (c) => {
    const r = await registryFor(c, 'admin');
    const body = PolicySchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) throw httpError('E_BAD_REQUEST', { detail: body.error.issues[0]?.path.join('.') ?? 'policy' });
    c.set('tenant', { registryId: r.id, slug: r.slug });
    await c.env.DB.batch([
      c.env.DB.prepare("UPDATE registries SET settings = json_set(settings, '$.policy', json(?1)) WHERE id = ?2").bind(
        JSON.stringify(body.data),
        r.id,
      ),
      audit(c, 'registry.policy', 'registry', r.id, body.data),
    ]);
    return c.json({ ok: true, policy: body.data });
  })
  // Auditoría exportable (V10-04): solo admins. JSON paginado (`next`) o el rango completo en CSV/JSONL (máx. 50 000).
  .get('/:slug/audit', async (c) => {
    const r = await registryFor(c, 'admin');
    const q = z
      .object({
        from: z.string().optional(),
        to: z.string().optional(),
        action: z
          .string()
          .regex(/^[a-z._]{1,40}$/)
          .optional(),
        format: z.enum(['json', 'csv', 'jsonl']).default('json'),
        after: z
          .string()
          .regex(/^aud_[0-9A-Za-z]+$/)
          .optional(),
      })
      .safeParse(c.req.query());
    if (!q.success) throw httpError('E_BAD_REQUEST', { detail: q.error.issues[0]?.path.join('.') ?? 'query' });
    const from = q.data.from ? Date.parse(q.data.from) : 0;
    const to = q.data.to ? Date.parse(q.data.to) : Date.now() + 1;
    if (Number.isNaN(from) || Number.isNaN(to)) throw httpError('E_BAD_REQUEST', { detail: 'from/to' });
    type Ev = {
      id: string;
      action: string;
      target_type: string;
      target_id: string;
      metadata: string | null;
      created_at: number;
      actor: string | null;
    };
    const page = (after: string) =>
      c.env.DB.prepare(
        `SELECT a.id, a.action, a.target_type, a.target_id, a.metadata, a.created_at, ac.handle AS actor
         FROM audit_log a LEFT JOIN accounts ac ON ac.id = a.actor_id
         WHERE a.registry_id = ?1 AND a.created_at >= ?2 AND a.created_at < ?3 AND (?4 = '' OR a.action LIKE ?4 || '%') AND a.id > ?5
         ORDER BY a.id LIMIT 1000`,
      )
        .bind(r.id, from, to, q.data.action ?? '', after)
        .all<Ev>()
        .then((x) => x.results);
    const shape = (e: Ev) => ({
      id: e.id,
      at: new Date(e.created_at).toISOString(),
      actor: e.actor,
      action: e.action,
      target: `${e.target_type}:${e.target_id}`,
      metadata: e.metadata ? (JSON.parse(e.metadata) as unknown) : null,
    });
    if (q.data.format === 'json') {
      const rows = await page(q.data.after ?? '');
      return c.json({ events: rows.map(shape), next: rows.length === 1000 ? rows.at(-1)!.id : null });
    }
    const all: Ev[] = [];
    for (let after = q.data.after ?? ''; all.length < 50_000; ) {
      const rows = await page(after);
      all.push(...rows);
      if (rows.length < 1000) break;
      after = rows.at(-1)!.id;
    }
    const file = `genpm-audit-${r.slug}-${new Date().toISOString().slice(0, 10)}.${q.data.format}`;
    const headers = { 'Content-Disposition': `attachment; filename="${file}"`, 'Cache-Control': 'private, no-store' };
    if (q.data.format === 'jsonl')
      return c.body(all.map((e) => JSON.stringify(shape(e))).join('\n') + (all.length ? '\n' : ''), 200, {
        ...headers,
        'Content-Type': 'application/x-ndjson; charset=utf-8',
      });
    const cell = (v: unknown) => {
      const t = v === null || v === undefined ? '' : typeof v === 'string' ? v : JSON.stringify(v);
      // Sin fórmulas al abrirlo en una hoja de cálculo (CSV injection).
      const safe = /^[=+\-@\t\r]/.test(t) ? `'${t}` : t;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const lines = ['id,at,actor,action,target,metadata'];
    for (const e of all.map(shape))
      lines.push([e.id, e.at, e.actor, e.action, e.target, e.metadata].map(cell).join(','));
    return c.body(`${lines.join('\r\n')}\r\n`, 200, { ...headers, 'Content-Type': 'text/csv; charset=utf-8' });
  })
  // Dominio propio (V10-03): PUT pide el dominio y devuelve el TXT a publicar; POST …/verify lo comprueba y lo activa.
  .put('/:slug/domain', requireAuth('publish'), async (c) => {
    const r = await registryFor(c, 'admin');
    const body = z
      .strictObject({ domain: z.string().toLowerCase().regex(DOMAIN_RE) })
      .safeParse(await c.req.json().catch(() => null));
    if (!body.success || isOwnHost(body.data.domain)) throw httpError('E_BAD_REQUEST', { detail: 'domain' });
    const token = `genpm-verify-${newToken().slice(4, 36)}`;
    const domain = body.data.domain;
    c.set('tenant', { registryId: r.id, slug: r.slug });
    await c.env.DB.batch([
      c.env.DB.prepare("UPDATE registries SET settings = json_set(settings, '$.domain', json(?1)) WHERE id = ?2").bind(
        JSON.stringify({ name: domain, token, requestedAt: Date.now() }),
        r.id,
      ),
      audit(c, 'registry.domain_request', 'registry', r.id, { domain }),
    ]);
    return c.json({
      domain,
      status: 'pending_verification',
      txt: { name: challengeName(domain), value: token },
      cname: { name: domain, value: CNAME_TARGET },
    });
  })
  .post('/:slug/domain/verify', requireAuth('publish'), async (c) => {
    const r = await registryFor(c, 'admin');
    const row = await c.env.DB.prepare("SELECT json_extract(settings, '$.domain') AS d FROM registries WHERE id = ?1")
      .bind(r.id)
      .first<{ d: string | null }>();
    const pending = row?.d ? (JSON.parse(row.d) as { name: string; token: string }) : null;
    if (!pending) throw httpError('E_NOT_FOUND', { name: 'domain' });
    if (!(await verifyTxt(pending.name, pending.token)))
      return c.json(
        {
          domain: pending.name,
          status: 'pending_verification',
          txt: { name: challengeName(pending.name), value: pending.token },
        },
        409,
      );
    c.set('tenant', { registryId: r.id, slug: r.slug });
    try {
      await c.env.DB.batch([
        c.env.DB.prepare(
          "UPDATE registries SET custom_domain = ?1, settings = json_remove(settings, '$.domain') WHERE id = ?2",
        ).bind(pending.name, r.id),
        audit(c, 'registry.domain', 'registry', r.id, { domain: pending.name }),
      ]);
    } catch (e) {
      if (String(e).includes('UNIQUE')) throw httpError('E_BAD_REQUEST', { detail: 'domain taken' });
      throw e;
    }
    const ssl = await addCustomHostname(c.env, pending.name);
    return c.json({ domain: pending.name, status: 'active', ssl, url: `https://${pending.name}` });
  })
  .delete('/:slug/domain', requireAuth('publish'), async (c) => {
    const r = await registryFor(c, 'admin');
    if (r.custom_domain) await removeCustomHostname(c.env, r.custom_domain);
    c.set('tenant', { registryId: r.id, slug: r.slug });
    await c.env.DB.batch([
      c.env.DB.prepare(
        "UPDATE registries SET custom_domain = NULL, settings = json_remove(settings, '$.domain') WHERE id = ?1",
      ).bind(r.id),
      audit(c, 'registry.domain_remove', 'registry', r.id, { domain: r.custom_domain }),
    ]);
    return c.json({ ok: true });
  })
  .delete('/:slug/members/:handle', requireAuth('publish'), async (c) => {
    const r = await registryFor(c, 'admin');
    const who = await accountByHandle(c.env.DB, c.req.param('handle'));
    const res = who
      ? await c.env.DB.prepare('DELETE FROM registry_members WHERE registry_id = ?1 AND account_id = ?2')
          .bind(r.id, who.id)
          .run()
      : null;
    if (!who || !res?.meta.changes) throw httpError('E_NOT_FOUND', { name: c.req.param('handle') });
    c.set('tenant', { registryId: r.id, slug: r.slug });
    await audit(c, 'registry.member_remove', 'account', who.id, { handle: who.handle }).run();
    return c.json({ ok: true });
  });

// ───────────── Equipos ─────────────

async function orgFor(c: Context<AppEnv>, admin: boolean) {
  const org = await accountByHandle(c.env.DB, c.req.param('org') ?? '');
  const role = org?.kind === 'org' ? await orgRole(c.env.DB, org.id, c.get('actor')!.accountId) : null;
  if (!org || !role) throw httpError('E_NOT_FOUND', { name: c.req.param('org') ?? '' });
  if (admin && !isOrgAdmin(role)) throw httpError('E_FORBIDDEN_SCOPE', { scope: org.handle });
  return { ...org, role };
}

async function teamFor(c: Context<AppEnv>, orgId: string) {
  const team = await c.env.DB.prepare('SELECT id, slug, name FROM teams WHERE org_id = ?1 AND slug = ?2')
    .bind(orgId, c.req.param('team') ?? '')
    .first<{ id: string; slug: string; name: string }>();
  if (!team) throw httpError('E_NOT_FOUND', { name: c.req.param('team') ?? '' });
  return team;
}

export const teams = new Hono<AppEnv>()
  .use('*', requireAuth())
  .get('/:org/teams', async (c) => {
    const org = await orgFor(c, false);
    const { results } = await c.env.DB.prepare(
      `SELECT t.id, t.slug, t.name, a.handle, m.role FROM teams t
       LEFT JOIN team_members m ON m.team_id = t.id LEFT JOIN accounts a ON a.id = m.user_id
       WHERE t.org_id = ?1 ORDER BY t.slug, a.handle`,
    )
      .bind(org.id)
      .all<{ id: string; slug: string; name: string; handle: string | null; role: string | null }>();
    const byTeam = new Map<string, { slug: string; name: string; members: Array<{ handle: string; role: string }> }>();
    for (const r of results) {
      const t = byTeam.get(r.id) ?? { slug: r.slug, name: r.name, members: [] };
      if (r.handle && r.role) t.members.push({ handle: r.handle, role: r.role });
      byTeam.set(r.id, t);
    }
    return c.json({ org: org.handle, teams: [...byTeam.values()] });
  })
  .post('/:org/teams', requireAuth('publish'), async (c) => {
    const org = await orgFor(c, true);
    const body = z
      .strictObject({ slug: z.string().regex(SLUG), name: z.string().trim().min(1).max(80).optional() })
      .safeParse(await c.req.json().catch(() => null));
    if (!body.success) throw httpError('E_BAD_REQUEST', { detail: body.error.issues[0]?.path.join('.') ?? 'body' });
    const id = newId('team');
    try {
      await c.env.DB.batch([
        c.env.DB.prepare('INSERT INTO teams (id, org_id, slug, name, created_at) VALUES (?1, ?2, ?3, ?4, ?5)').bind(
          id,
          org.id,
          body.data.slug,
          body.data.name ?? body.data.slug,
          Date.now(),
        ),
        audit(c, 'team.create', 'team', id, { org: org.handle, slug: body.data.slug }),
      ]);
    } catch (e) {
      if (String(e).includes('UNIQUE')) throw httpError('E_BAD_REQUEST', { detail: 'slug taken' });
      throw e;
    }
    return c.json({ ok: true, slug: body.data.slug }, 201);
  })
  .delete('/:org/teams/:team', requireAuth('publish'), async (c) => {
    const org = await orgFor(c, true);
    const team = await teamFor(c, org.id);
    await c.env.DB.batch([
      c.env.DB.prepare("DELETE FROM package_grants WHERE principal_type = 'team' AND principal_id = ?1").bind(team.id),
      c.env.DB.prepare('DELETE FROM teams WHERE id = ?1').bind(team.id),
      audit(c, 'team.delete', 'team', team.id, { org: org.handle, slug: team.slug }),
    ]);
    return c.json({ ok: true });
  })
  .put('/:org/teams/:team/members/:handle', requireAuth('publish'), async (c) => {
    const org = await orgFor(c, false);
    const team = await teamFor(c, org.id);
    const actor = c.get('actor')!;
    const maintainer = await c.env.DB.prepare(
      "SELECT 1 AS ok FROM team_members WHERE team_id = ?1 AND user_id = ?2 AND role = 'maintainer'",
    )
      .bind(team.id, actor.accountId)
      .first();
    if (!isOrgAdmin(org.role) && !maintainer) throw httpError('E_FORBIDDEN_SCOPE', { scope: org.handle });
    const body = z
      .strictObject({ role: z.enum(['maintainer', 'member']).default('member') })
      .safeParse((await c.req.json().catch(() => ({}))) ?? {});
    if (!body.success) throw httpError('E_BAD_REQUEST', { detail: 'role' });
    const who = await accountByHandle(c.env.DB, c.req.param('handle'));
    // Solo personas que ya son miembros de la org.
    if (!who || who.kind !== 'user' || !(await orgRole(c.env.DB, org.id, who.id)))
      throw httpError('E_NOT_FOUND', { name: c.req.param('handle') });
    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO team_members (team_id, user_id, role) VALUES (?1, ?2, ?3)
         ON CONFLICT (team_id, user_id) DO UPDATE SET role = ?3`,
      ).bind(team.id, who.id, body.data.role),
      audit(c, 'team.member', 'team', team.id, { handle: who.handle, role: body.data.role }),
    ]);
    return c.json({ ok: true });
  })
  .delete('/:org/teams/:team/members/:handle', requireAuth('publish'), async (c) => {
    const org = await orgFor(c, true);
    const team = await teamFor(c, org.id);
    const who = await accountByHandle(c.env.DB, c.req.param('handle'));
    const res = who
      ? await c.env.DB.prepare('DELETE FROM team_members WHERE team_id = ?1 AND user_id = ?2')
          .bind(team.id, who.id)
          .run()
      : null;
    if (!who || !res?.meta.changes) throw httpError('E_NOT_FOUND', { name: c.req.param('handle') });
    await audit(c, 'team.member_remove', 'team', team.id, { handle: who.handle }).run();
    return c.json({ ok: true });
  });

// ───────────── Visibilidad y grants por paquete ─────────────

const PKG = '/:scope{@[a-z0-9][a-z0-9-]*}/:name{[a-z0-9][a-z0-9-]*}';

/** Admin del paquete: admin del registro privado, owner/admin de la org dueña o grant `admin`. */
export async function packageAdmin(c: Context<AppEnv>, actor: Actor) {
  const priv = c.get('tenant').private;
  const name = fullName(c);
  const pkg = await repoOf(c).packageByName(name);
  if (!pkg || !priv) throw httpError('E_NOT_FOUND', { name });
  const ok =
    priv.role === 'admin' ||
    isOrgAdmin(await orgRole(c.env.DB, pkg.owner_id, actor.accountId)) ||
    (await grantOf(c.env.DB, pkg.id, priv.principals)) === 'admin';
  if (!ok) throw httpError('E_FORBIDDEN_SCOPE', { scope: name.split('/')[0]! });
  return pkg;
}

/** `user:alice` o `team:acme/backend` → principal. */
async function principal(db: D1Database, raw: string): Promise<{ type: 'user' | 'team'; id: string } | null> {
  const user = raw.match(/^user:@?([A-Za-z0-9-]{1,39})$/);
  if (user) {
    const a = await accountByHandle(db, user[1]!);
    return a?.kind === 'user' ? { type: 'user', id: a.id } : null;
  }
  const team = raw.match(/^team:@?([A-Za-z0-9-]{1,39})\/([a-z0-9][a-z0-9-]{1,38})$/);
  if (!team) return null;
  const t = await db
    .prepare('SELECT t.id FROM teams t JOIN accounts a ON a.id = t.org_id WHERE a.handle = ?1 AND t.slug = ?2')
    .bind(team[1]!, team[2]!)
    .first<{ id: string }>();
  return t ? { type: 'team', id: t.id } : null;
}

export const access = new Hono<AppEnv>()
  .get(`${PKG}/access`, requireAuth(), async (c) => {
    const pkg = await packageAdmin(c, c.get('actor')!);
    const { results } = await c.env.DB.prepare(
      `SELECT g.principal_type AS type, g.permission,
              CASE g.principal_type WHEN 'user' THEN (SELECT handle FROM accounts WHERE id = g.principal_id)
                ELSE (SELECT a.handle || '/' || t.slug FROM teams t JOIN accounts a ON a.id = t.org_id WHERE t.id = g.principal_id) END AS who
       FROM package_grants g WHERE g.package_id = ?1 ORDER BY g.principal_type, who`,
    )
      .bind(pkg.id)
      .all<{ type: string; permission: string; who: string | null }>();
    return c.json({
      name: pkg.full_name,
      visibility: pkg.visibility,
      grants: results.filter((r) => r.who).map((r) => ({ principal: `${r.type}:${r.who}`, permission: r.permission })),
    });
  })
  .put(`${PKG}/access`, requireAuth('publish'), async (c) => {
    const pkg = await packageAdmin(c, c.get('actor')!);
    const body = z
      .strictObject({ visibility: z.enum(['internal', 'private']) })
      .safeParse(await c.req.json().catch(() => null));
    if (!body.success) throw httpError('E_BAD_REQUEST', { detail: 'visibility' });
    await c.env.DB.batch([
      c.env.DB.prepare('UPDATE packages SET visibility = ?1, updated_at = ?2 WHERE id = ?3').bind(
        body.data.visibility,
        Date.now(),
        pkg.id,
      ),
      audit(c, 'package.visibility', 'package', pkg.id, { visibility: body.data.visibility }),
    ]);
    return c.json({ ok: true, visibility: body.data.visibility });
  })
  .put(`${PKG}/grants`, requireAuth('publish'), async (c) => {
    const pkg = await packageAdmin(c, c.get('actor')!);
    const body = z
      .strictObject({ principal: z.string().max(100), permission: z.enum(['read', 'write', 'admin']) })
      .safeParse(await c.req.json().catch(() => null));
    if (!body.success) throw httpError('E_BAD_REQUEST', { detail: body.error.issues[0]?.path.join('.') ?? 'body' });
    const p = await principal(c.env.DB, body.data.principal);
    if (!p) throw httpError('E_NOT_FOUND', { name: body.data.principal });
    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO package_grants (package_id, principal_type, principal_id, permission, created_at) VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT (package_id, principal_type, principal_id) DO UPDATE SET permission = ?4`,
      ).bind(pkg.id, p.type, p.id, body.data.permission, Date.now()),
      audit(c, 'package.grant', 'package', pkg.id, body.data),
    ]);
    return c.json({ ok: true });
  })
  .delete(`${PKG}/grants`, requireAuth('publish'), async (c) => {
    const pkg = await packageAdmin(c, c.get('actor')!);
    const raw = c.req.query('principal') ?? '';
    const p = await principal(c.env.DB, raw);
    const res = p
      ? await c.env.DB.prepare(
          'DELETE FROM package_grants WHERE package_id = ?1 AND principal_type = ?2 AND principal_id = ?3',
        )
          .bind(pkg.id, p.type, p.id)
          .run()
      : null;
    if (!p || !res?.meta.changes) throw httpError('E_NOT_FOUND', { name: raw });
    await audit(c, 'package.revoke', 'package', pkg.id, { principal: raw }).run();
    return c.json({ ok: true });
  });
