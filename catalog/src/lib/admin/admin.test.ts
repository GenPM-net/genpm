import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineRole, grantRole } from '../rbac/index.ts';
import { admin, type Note, notes, notesResource, ORIGIN, owner, setup, userWithCookie } from './__fixtures__/admin.ts';
import { adminRoutes } from './adapters/hono.ts';
import { adminRouteHandlers } from './adapters/next.ts';
import { displayValue, formValues, getPath, inputToMoney, moneyToInput, parseRoute, routePath, setPath } from './client.ts';
import { ADMIN_HEADER, defineAdmin, fieldsFromZod, handleAdminApi, listAudit } from './index.ts';

let ownerId: string;
let ownerCookie: string;
beforeEach(async () => {
  await setup();
  ({ id: ownerId, cookie: ownerCookie } = owner());
});

const call = (path: string, init: RequestInit & { cookie?: string; csrf?: boolean } = {}) => {
  const headers = new Headers(init.headers);
  if (init.cookie) headers.set('cookie', init.cookie);
  if (init.csrf !== false && init.method && init.method !== 'GET') {
    headers.set(ADMIN_HEADER, '1');
    headers.set('origin', ORIGIN);
  }
  if (init.body) headers.set('content-type', 'application/json');
  return handleAdminApi(new Request(`${ORIGIN}/api/admin${path}`, { ...init, headers }), admin);
};

describe('config', () => {
  it('rejects duplicate or invalid resource names', () => {
    expect(() => defineAdmin({ resources: [notesResource, notesResource] })).toThrow(/duplicate/);
    expect(() => defineAdmin({ resources: [{ ...notesResource, name: 'Bad Name' }] })).toThrow(/invalid/);
  });

  it('derives fields from zod', () => {
    const f = fieldsFromZod(z.object({ at: z.date(), n: z.number().optional(), kind: z.enum(['a', 'b']), url: z.url(), ok: z.boolean() }));
    expect(f.map((x) => [x.name, x.type, x.required])).toEqual([
      ['at', 'datetime', true],
      ['n', 'number', false],
      ['kind', 'select', true],
      ['url', 'url', true],
      ['ok', 'boolean', true],
    ]);
    expect(f[2]!.options).toEqual([
      { value: 'a', label: 'a' },
      { value: 'b', label: 'b' },
    ]);
  });
});

describe('API: authentication, permissions and CSRF', () => {
  it('requires a session and admin:access', async () => {
    expect((await call('/schema')).status).toBe(401);
    const nobody = await userWithCookie('nobody');
    expect((await call('/schema', { cookie: nobody.cookie })).status).toBe(403);
  });

  it('only shows resources and actions the user can use', async () => {
    await defineRole({ key: 'reader', label: 'Reader', rank: 10, permissions: ['admin:access', 'notes:read'] });
    const reader = await userWithCookie('reader');
    await grantRole(ownerId, reader.id, 'reader');
    const s = (await (await call('/schema', { cookie: reader.cookie })).json()) as { resources: Array<{ name: string; can: object; actions: unknown[] }> };
    expect(s.resources.map((r) => r.name)).toEqual(['notes']);
    expect(s.resources[0]!.can).toEqual({ create: false, update: false, delete: false });
    expect(s.resources[0]!.actions).toEqual([]);
    // Y el servidor no se fía de la UI: crear sin permiso falla igual.
    expect((await call('/notes', { method: 'POST', cookie: reader.cookie, body: JSON.stringify({ title: 'x', price: 1 }) })).status).toBe(403);
    expect((await call('/notes/n1/actions/publish', { method: 'POST', cookie: reader.cookie, body: '{}' })).status).toBe(403);

    const full = (await (await call('/schema', { cookie: ownerCookie })).json()) as { title: string; resources: Array<{ name: string; can: object; actions: Array<{ name: string; confirm: boolean; fields: unknown[] }> }> };
    expect(full.title).toBe('Test admin');
    expect(full.resources.map((r) => r.name)).toEqual(['notes', 'admin-audit']);
    expect(full.resources[0]!.can).toEqual({ create: true, update: true, delete: true });
    expect(full.resources[0]!.actions[0]).toMatchObject({ name: 'publish', confirm: true, fields: [{ name: 'note', type: 'text', required: false }] });
    expect(full.resources[1]!.can).toEqual({ create: false, update: false, delete: false });
  });

  it('rejects writes without the admin header or from another origin', async () => {
    const body = JSON.stringify({ title: 'X', price: 1 });
    expect((await call('/notes', { method: 'POST', cookie: ownerCookie, body, csrf: false })).status).toBe(403);
    const foreign = await handleAdminApi(
      new Request(`${ORIGIN}/api/admin/notes`, { method: 'POST', body, headers: { cookie: ownerCookie, [ADMIN_HEADER]: '1', origin: 'https://evil.test', 'content-type': 'application/json' } }),
      admin,
    );
    expect(foreign.status).toBe(403);
    expect(await foreign.json()).toEqual({ error: 'csrf' });
    expect(notes().size).toBe(2);
  });
});

describe('API: CRUD, actions and audit', () => {
  it('lists with search, sort and pagination and adds titles', async () => {
    const r = await call('/notes?q=alp&pageSize=10', { cookie: ownerCookie });
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(await r.json()).toEqual({ rows: [expect.objectContaining({ id: 'n1', _title: 'Alpha' })], total: 1 });
    const sorted = (await (await call('/notes?sort=title&dir=desc', { cookie: ownerCookie })).json()) as { rows: Note[] };
    expect(sorted.rows.map((n) => n.id)).toEqual(['n2', 'n1']);
    const page2 = (await (await call('/notes?page=2&pageSize=1', { cookie: ownerCookie })).json()) as { rows: Note[]; total: number };
    expect([page2.rows[0]!.id, page2.total]).toEqual(['n2', 2]);
  });

  it('creates, updates and deletes with an audit trail', async () => {
    const bad = await call('/notes', { method: 'POST', cookie: ownerCookie, body: JSON.stringify({ title: '', price: -1 }) });
    expect(bad.status).toBe(422);
    expect(((await bad.json()) as { issues: Array<{ path: string }> }).issues.map((i) => i.path).sort()).toEqual(['price', 'title']);

    const created = await call('/notes', { method: 'POST', cookie: ownerCookie, body: JSON.stringify({ title: 'Gamma', price: 100 }) });
    expect(created.status).toBe(201);
    const { id } = (await created.json()) as Note;
    expect((await call(`/notes/${id}`, { method: 'PUT', cookie: ownerCookie, body: JSON.stringify({ title: 'Gamma 2', price: 200 }) })).status).toBe(200);
    expect((await call(`/notes/${id}`, { method: 'DELETE', cookie: ownerCookie })).status).toBe(204);
    expect((await call(`/notes/${id}`, { cookie: ownerCookie })).status).toBe(404);

    const { rows } = await listAudit({ resource: 'notes', recordId: id });
    expect(rows.map((r) => r.action)).toEqual(['delete', 'update', 'create']);
    expect(rows.every((r) => r.userId === ownerId)).toBe(true);
    expect(rows[1]!.diff).toMatchObject({ before: { title: 'Gamma' }, after: { title: 'Gamma 2' } });
    expect(rows[0]!.diff).toMatchObject({ before: { title: 'Gamma 2' } });
  });

  it('runs actions only when available and validates their input', async () => {
    expect(((await (await call('/notes/n1', { cookie: ownerCookie })).json()) as { _actions: string[] })._actions).toEqual(['publish']);
    expect(((await (await call('/notes/n2', { cookie: ownerCookie })).json()) as { _actions: string[] })._actions).toEqual([]);
    expect((await call('/notes/n2/actions/publish', { method: 'POST', cookie: ownerCookie, body: '{}' })).status).toBe(422);
    expect((await call('/notes/n1/actions/publish', { method: 'POST', cookie: ownerCookie, body: JSON.stringify({ note: 'x'.repeat(20) }) })).status).toBe(422);
    expect((await call('/notes/n1/actions/nope', { method: 'POST', cookie: ownerCookie, body: '{}' })).status).toBe(404);
    const ok = await call('/notes/n1/actions/publish', { method: 'POST', cookie: ownerCookie, body: JSON.stringify({ note: 'go' }) });
    expect(((await ok.json()) as Note).status).toBe('published');
    const [entry] = (await listAudit({ resource: 'notes', recordId: 'n1' })).rows;
    expect(entry).toMatchObject({ action: 'action:publish', diff: { input: { note: 'go' } } });
  });

  it('serves widgets and the read-only audit resource', async () => {
    expect(await (await call('/widgets', { cookie: ownerCookie })).json()).toEqual({ widgets: [{ name: 'notes', title: 'Notes', value: 2 }] });
    await call('/notes/n1', { method: 'PUT', cookie: ownerCookie, body: JSON.stringify({ title: 'A', price: 1 }) });
    const audit = (await (await call('/admin-audit?f.resource=notes', { cookie: ownerCookie })).json()) as { rows: Array<{ _title: string }>; total: number };
    expect(audit.total).toBe(1);
    expect(audit.rows[0]!._title).toBe('update notes/n1');
    expect((await call('/admin-audit', { method: 'POST', cookie: ownerCookie, body: '{}' })).status).toBe(404);
  });

  it('works through the Hono and Next adapters', async () => {
    const app = adminRoutes(admin);
    const viaHono = await app.request(`${ORIGIN}/api/admin/notes`, { headers: { cookie: ownerCookie } });
    expect(((await viaHono.json()) as { total: number }).total).toBe(2);
    const { DELETE } = adminRouteHandlers(admin);
    const del = await DELETE(new Request(`${ORIGIN}/api/admin/notes/n2`, { method: 'DELETE', headers: { cookie: ownerCookie, [ADMIN_HEADER]: '1', referer: `${ORIGIN}/admin/notes` } }));
    expect(del.status).toBe(204);
  });
});

describe('client helpers', () => {
  it('reads and writes nested paths without prototype pollution', () => {
    expect(getPath({ data: { title: 'x' } }, 'data.title')).toBe('x');
    expect(setPath({ data: { a: 1 } }, 'data.b', 2)).toEqual({ data: { a: 1, b: 2 } });
    const polluted = setPath({}, '__proto__.admin', true);
    expect(({} as { admin?: boolean }).admin).toBeUndefined();
    expect(polluted).toEqual({});
    expect(formValues([{ name: 'data.title', label: 'T', type: 'text' }, { name: 'on', label: 'On', type: 'boolean' }, { name: 'id', label: 'Id', type: 'text', readOnly: true }], { id: '1', data: { title: 'Hi' } })).toEqual({
      data: { title: 'Hi' },
      on: false,
    });
  });

  it('converts money and renders cells', () => {
    expect(inputToMoney('19,99')).toBe(1999);
    expect(inputToMoney('')).toBeUndefined();
    expect(inputToMoney('1e3')).toBeNaN();
    expect(moneyToInput(500)).toBe('5.00');
    expect(displayValue({ name: 'p', label: 'P', type: 'money' }, { amount: 1999, currency: 'EUR' })).toBe('19.99 EUR');
    expect(displayValue({ name: 'b', label: 'B', type: 'boolean' }, true)).toBe('Yes');
    expect(displayValue({ name: 's', label: 'S', type: 'select', options: [{ value: 'a', label: 'Aa' }] }, 'a')).toBe('Aa');
  });

  it('round-trips routes', () => {
    for (const p of ['', '/notes', '/notes/new', '/notes/a%2Fb']) expect(routePath(parseRoute(p))).toBe(p);
  });
});

