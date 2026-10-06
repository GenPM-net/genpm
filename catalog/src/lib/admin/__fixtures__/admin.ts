// Panel de prueba con un recurso en memoria y un propietario con sesión (compartido por los tests de API y de UI).
import { z } from 'zod';
import * as authSchema from '../../auth/schema.js';
import { createSession, generateSessionToken, SESSION_COOKIE, upsertOAuthUser } from '../../auth/index.js';
import { type AdminContext, defineAdminResource } from '../../contracts/index.js';
import { testDb } from '../../db/__fixtures__/pglite.js';
import { bootstrapOwner } from '../../rbac/index.js';
import * as rbacSchema from '../../rbac/schema.js';
import * as schema from '../schema.js';
import { auditAdminResource, countWidget, defineAdmin } from '../index.js';

// Recurso en memoria: el panel no sabe nada de tablas, solo del contrato.
export type Note = { id: string; title: string; body: string; price: number; status: 'draft' | 'published'; ownerId: string };
let store: Map<string, Note> = new Map();
export const notes = () => store;
const forbidden = () => Object.assign(new Error('forbidden'), { code: 'forbidden' });
const need = async (ctx: AdminContext, p: string) => {
  if (!(await ctx.can(p))) throw forbidden();
};
const NoteInput = z.object({ title: z.string().min(1), body: z.string().default(''), price: z.number().int().nonnegative() });
export const notesResource = defineAdminResource<Note>({
  name: 'notes',
  label: { singular: 'Note', plural: 'Notes' },
  group: 'Content',
  fields: [
    { name: 'title', label: 'Title', type: 'text', required: true, list: true },
    { name: 'body', label: 'Body', type: 'textarea' },
    { name: 'price', label: 'Price', type: 'money', list: true },
    { name: 'status', label: 'Status', type: 'select', readOnly: true, list: true, options: [{ value: 'draft', label: 'Draft' }, { value: 'published', label: 'Published' }] },
  ],
  input: NoteInput,
  title: (n) => n.title,
  async list(q, ctx) {
    await need(ctx, 'notes:read');
    let rows = [...store.values()];
    if (q.search) rows = rows.filter((n) => n.title.toLowerCase().includes(q.search!.toLowerCase()));
    if (q.sort?.field === 'title') rows.sort((a, b) => a.title.localeCompare(b.title) * (q.sort!.dir === 'asc' ? 1 : -1));
    return { rows: rows.slice((q.page - 1) * q.pageSize, q.page * q.pageSize), total: rows.length };
  },
  async get(id, ctx) {
    await need(ctx, 'notes:read');
    return store.get(id) ?? null;
  },
  async create(input, ctx) {
    await need(ctx, 'notes:create');
    const n: Note = { id: `n${store.size + 1}`, ...(input as z.infer<typeof NoteInput>), status: 'draft', ownerId: ctx.user.id };
    store.set(n.id, n);
    return n;
  },
  async update(id, input, ctx) {
    await need(ctx, 'notes:update');
    const cur = store.get(id);
    if (!cur) throw Object.assign(new Error('nf'), { code: 'not_found' });
    const n = { ...cur, ...(input as object) };
    store.set(id, n);
    return n;
  },
  async delete(id, ctx) {
    await need(ctx, 'notes:delete');
    store.delete(id);
  },
  actions: [
    {
      name: 'publish',
      label: 'Publish',
      permission: 'notes:publish',
      confirm: true,
      input: z.object({ note: z.string().max(10).optional() }),
      available: (n) => n.status === 'draft',
      async run(id) {
        const n = { ...store.get(id)!, status: 'published' as const };
        store.set(id, n);
        return n;
      },
    },
  ],
});

export const admin = defineAdmin({
  title: 'Test admin',
  resources: [notesResource, auditAdminResource],
  widgets: [countWidget('notes', 'Notes', 'notes:read', async () => store.size)],
});

export const ORIGIN = 'http://localhost';

export async function userWithCookie(name: string) {
  const u = await upsertOAuthUser('github', { id: name, email: `${name}@x.test`, emailVerified: true, name, avatarUrl: null });
  const t = generateSessionToken();
  await createSession(t, u.id);
  return { id: u.id, cookie: `${SESSION_COOKIE}=${t}` };
}

let current = { id: '', cookie: '' };
export const owner = () => current;

export async function setup() {
  process.env.AUTH_SECRET = 'x'.repeat(40);
  await testDb(authSchema, rbacSchema, schema);
  store = new Map([
    ['n1', { id: 'n1', title: 'Alpha', body: '', price: 1999, status: 'draft', ownerId: 'x' }],
    ['n2', { id: 'n2', title: 'Beta', body: '', price: 500, status: 'published', ownerId: 'x' }],
  ]);
  current = await userWithCookie('owner');
  await bootstrapOwner(current.id);
}
