// API JSON del panel (independiente del framework): sesión de @core/auth, permisos de @core/rbac, protección CSRF y
// auditoría. Rutas relativas a la base (p. ej. /api/admin):
//   GET  /schema · GET /widgets · GET /:resource · GET /:resource/:id · POST /:resource · PUT /:resource/:id
//   DELETE /:resource/:id · POST /:resource/:id/actions/:action
import { and, count, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getUserFromCookieHeader, type User } from '../auth/index.js';
import type { AdminContext, AdminResource } from '../contracts/index.js';
import { type Executor, getDb } from '../db/index.js';
import { getGrants, grants } from '../rbac/index.js';
import { type AdminConfig, fieldsFromZod } from './config.js';
import { ADMIN_HEADER } from './constants.js';
import { type AdminAudit, adminAudit } from './schema.js';

export { ADMIN_HEADER };

/** Contexto de permisos del usuario: `can('posts:update')`, y también `can('posts:update:own')` para dueños. */
export async function adminContextFor(user: Pick<User, 'id' | 'email' | 'name'>): Promise<AdminContext> {
  const g = await getGrants(user.id);
  return {
    user: { id: user.id, email: user.email ?? null, name: user.name ?? null },
    async can(permission: string) {
      if (permission.endsWith(':own')) {
        const [resource, action] = permission.split(':');
        return g.permissions.some((p) => p === '*' || p === permission || p === `${resource}:*:own` || p === `${resource}:*` || p === `${resource}:${action}`);
      }
      return grants(g.permissions, permission, user.id);
    },
  };
}

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

function errorResponse(e: unknown): Response {
  if (e instanceof z.ZodError) return json({ error: 'invalid', issues: e.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) }, 422);
  const code = (e as { code?: unknown })?.code;
  if (typeof code === 'string') {
    const status = code === 'forbidden' ? 403 : code === 'not_found' ? 404 : /^(invalid|slug_taken|too_much|out_of_stock|invalid_state|invalid_transition|invalid_data|no_provider|no_price_rule|redirect_loop|currency|unsupported|unknown_role|last_owner|system_role)/.test(code) ? 422 : 400;
    return json({ error: code, message: (e as Error).message, ...((e as { issues?: unknown }).issues ? { issues: (e as { issues: unknown }).issues } : {}) }, status);
  }
  throw e;
}

const trim = (v: unknown) => {
  const s = JSON.stringify(v ?? null);
  return s.length > 20_000 ? { truncated: true } : JSON.parse(s);
};

async function audit(db: Executor, ctx: AdminContext, resource: string, recordId: string | null, action: string, diff: Record<string, unknown>) {
  await db.insert(adminAudit).values({ userId: ctx.user.id, resource, recordId, action, diff: trim(diff) });
}

/** Mismo origen (anti-CSRF): Origin o Referer deben coincidir con el host de la petición. */
function sameOrigin(req: Request): boolean {
  const host = new URL(req.url).host;
  const src = req.headers.get('origin') ?? req.headers.get('referer');
  if (!src) return false;
  try {
    return new URL(src).host === host;
  } catch {
    return false;
  }
}

export type AdminApiOptions = {
  basePath?: string;
  db?: Executor;
  /** Resolución del usuario (por defecto, la cookie de sesión de @core/auth). */
  getUser?: (req: Request) => Promise<Pick<User, 'id' | 'email' | 'name'> | null>;
};

export async function handleAdminApi(req: Request, admin: AdminConfig, opts: AdminApiOptions = {}): Promise<Response> {
  const db = opts.db ?? getDb();
  const base = (opts.basePath ?? '/api/admin').replace(/\/+$/, '');
  const url = new URL(req.url);
  if (!url.pathname.startsWith(base)) return json({ error: 'not_found' }, 404);
  const parts = url.pathname.slice(base.length).split('/').filter(Boolean).map(decodeURIComponent);
  const user = opts.getUser ? await opts.getUser(req) : await getUserFromCookieHeader(req.headers.get('cookie'));
  if (!user) return json({ error: 'unauthorized' }, 401);
  const ctx = await adminContextFor(user);
  if (!(await ctx.can('admin:access'))) return json({ error: 'forbidden' }, 403);
  if (req.method !== 'GET' && (req.headers.get(ADMIN_HEADER) !== '1' || !sameOrigin(req))) return json({ error: 'csrf' }, 403);

  try {
    if (req.method === 'GET' && parts[0] === 'schema' && parts.length === 1) {
      const visible = [];
      for (const r of admin.resources) {
        const read = (await ctx.can(`${r.name}:read`)) || (await ctx.can(`${r.name}:read:own`));
        if (!read) continue;
        visible.push({
          name: r.name,
          label: r.label,
          group: r.group ?? null,
          icon: r.icon ?? null,
          fields: r.fields.length ? r.fields : fieldsFromZod(r.input),
          can: {
            create: !!r.create && ((await ctx.can(`${r.name}:create`)) || (await ctx.can(`${r.name}:create:own`))),
            update: !!r.update && ((await ctx.can(`${r.name}:update`)) || (await ctx.can(`${r.name}:update:own`))),
            delete: !!r.delete && ((await ctx.can(`${r.name}:delete`)) || (await ctx.can(`${r.name}:delete:own`))),
          },
          actions: (
            await Promise.all(
              (r.actions ?? []).map(async (a) => ((await ctx.can(a.permission)) || (await ctx.can(`${a.permission}:own`)) ? { name: a.name, label: a.label, confirm: !!a.confirm, fields: fieldsFromZod(a.input) } : null)),
            )
          ).filter(Boolean),
        });
      }
      return json({ title: admin.title, user: ctx.user, resources: visible });
    }
    if (req.method === 'GET' && parts[0] === 'widgets' && parts.length === 1) {
      const out = [];
      for (const w of admin.widgets) if (await ctx.can(w.permission)) out.push({ name: w.name, title: w.title, ...(await w.load(ctx).catch(() => ({ value: '—' }))) });
      return json({ widgets: out });
    }
    const resource = admin.resources.find((r) => r.name === parts[0]);
    if (!resource) return json({ error: 'not_found' }, 404);
    const id = parts[1];
    if (req.method === 'GET' && !id) {
      const filters: Record<string, string> = {};
      for (const [k, v] of url.searchParams) if (k.startsWith('f.') && v) filters[k.slice(2)] = v.slice(0, 200);
      const sortField = url.searchParams.get('sort');
      const result = await resource.list(
        {
          page: Math.max(Number(url.searchParams.get('page') ?? 1) || 1, 1),
          pageSize: Math.min(Math.max(Number(url.searchParams.get('pageSize') ?? 20) || 20, 1), 100),
          ...(url.searchParams.get('q') && { search: url.searchParams.get('q')!.slice(0, 200) }),
          ...(sortField && { sort: { field: sortField, dir: url.searchParams.get('dir') === 'desc' ? ('desc' as const) : ('asc' as const) } }),
          ...(Object.keys(filters).length && { filters }),
        },
        ctx,
      );
      return json({ rows: result.rows.map((row) => ({ ...row, _title: resource.title(row) })), total: result.total });
    }
    if (req.method === 'GET' && id && parts.length === 2) {
      const row = await resource.get(id, ctx);
      if (!row) return json({ error: 'not_found' }, 404);
      const actions = (resource.actions ?? []).filter((a) => !a.available || a.available(row)).map((a) => a.name);
      const links = resource.links ? (await resource.links(row, ctx)).filter((l) => /^\/(?![/\\])/.test(l.href) || l.href.startsWith('https://')) : [];
      return json({ ...row, _title: resource.title(row), _actions: actions, _links: links });
    }
    const body = req.method === 'DELETE' ? undefined : await req.json().catch(() => undefined);
    if (req.method === 'POST' && !id) {
      if (!resource.create) return json({ error: 'not_found' }, 404);
      const row = await resource.create(resource.input.parse(body), ctx);
      await audit(db, ctx, resource.name, row.id, 'create', { after: row });
      return json(row, 201);
    }
    if (req.method === 'PUT' && id && parts.length === 2) {
      if (!resource.update) return json({ error: 'not_found' }, 404);
      const before = await resource.get(id, ctx);
      const row = await resource.update(id, resource.input.parse(body), ctx);
      await audit(db, ctx, resource.name, id, 'update', { before, after: row });
      return json(row);
    }
    if (req.method === 'DELETE' && id && parts.length === 2) {
      if (!resource.delete) return json({ error: 'not_found' }, 404);
      const before = await resource.get(id, ctx);
      await resource.delete(id, ctx);
      await audit(db, ctx, resource.name, id, 'delete', { before });
      return new Response(null, { status: 204 });
    }
    if (req.method === 'POST' && id && parts[2] === 'actions' && parts[3] && parts.length === 4) {
      const action = resource.actions?.find((a) => a.name === parts[3]);
      if (!action) return json({ error: 'not_found' }, 404);
      if (!(await ctx.can(action.permission)) && !(await ctx.can(`${action.permission}:own`))) return json({ error: 'forbidden' }, 403);
      if (action.available) {
        const current = await resource.get(id, ctx);
        if (!current) return json({ error: 'not_found' }, 404);
        if (!action.available(current)) return json({ error: 'invalid_state' }, 422);
      }
      const input = action.input ? action.input.parse(body ?? {}) : {};
      const row = await action.run(id, input, ctx);
      await audit(db, ctx, resource.name, id, `action:${action.name}`, { input, after: row });
      return json(row);
    }
    return json({ error: 'not_found' }, 404);
  } catch (e) {
    return errorResponse(e);
  }
}

/** Historial de cambios (más reciente primero), filtrable por recurso, registro o usuario. */
export async function listAudit(q: { resource?: string; recordId?: string; userId?: string; page?: number; pageSize?: number } = {}, db: Executor = getDb()) {
  const where = and(
    q.resource ? eq(adminAudit.resource, q.resource) : undefined,
    q.recordId ? eq(adminAudit.recordId, q.recordId) : undefined,
    q.userId ? eq(adminAudit.userId, q.userId) : undefined,
  );
  const size = Math.min(Math.max(q.pageSize ?? 50, 1), 200);
  const rows = await db
    .select()
    .from(adminAudit)
    .where(where)
    .orderBy(desc(adminAudit.createdAt), desc(adminAudit.id))
    .limit(size)
    .offset((Math.max(q.page ?? 1, 1) - 1) * size);
  const [total] = await db.select({ n: count() }).from(adminAudit).where(where);
  return { rows, total: total?.n ?? 0 };
}

/** Recurso de solo lectura "Audit log" (permiso `admin-audit:read`). Añádelo a `defineAdmin` si quieres verlo. */
export const auditAdminResource: AdminResource<AdminAudit> = {
  name: 'admin-audit',
  label: { singular: 'Audit entry', plural: 'Audit log' },
  group: 'Settings',
  fields: [
    { name: 'resource', label: 'Resource', type: 'text', readOnly: true, list: true },
    { name: 'recordId', label: 'Record', type: 'text', readOnly: true, list: true },
    { name: 'action', label: 'Action', type: 'text', readOnly: true, list: true },
    { name: 'userId', label: 'User', type: 'text', readOnly: true, list: true },
    { name: 'createdAt', label: 'Date', type: 'datetime', readOnly: true, list: true },
    { name: 'diff', label: 'Changes', type: 'json', readOnly: true },
  ],
  input: z.never(),
  title: (r) => `${r.action} ${r.resource}${r.recordId ? `/${r.recordId}` : ''}`,
  async list(q, ctx) {
    if (!(await ctx.can('admin-audit:read'))) throw Object.assign(new Error('forbidden'), { code: 'forbidden' });
    return listAudit({ ...(q.filters?.resource && { resource: q.filters.resource }), ...(q.filters?.recordId && { recordId: q.filters.recordId }), ...(q.filters?.userId && { userId: q.filters.userId }), page: q.page, pageSize: q.pageSize });
  },
  async get(id, ctx) {
    if (!(await ctx.can('admin-audit:read'))) throw Object.assign(new Error('forbidden'), { code: 'forbidden' });
    const [row] = await getDb().select().from(adminAudit).where(eq(adminAudit.id, id));
    return row ?? null;
  },
};
