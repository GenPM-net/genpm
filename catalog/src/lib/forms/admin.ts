// Panel: envíos (lista, detalle, marcar, borrar), exportación CSV y formularios editables (colección `forms`).
import { and, asc, count, desc, eq, lt, type SQL, sql } from 'drizzle-orm';
import { z } from 'zod';
import { contentAdminResource } from '../content/index.js';
import type { AdminContext, AdminResource } from '../contracts/index.js';
import { type Executor, getDb } from '../db/index.js';
import { type FormSubmission, formSubmissions } from './schema.js';

class FormsForbidden extends Error {
  readonly code = 'forbidden';
}

async function need(ctx: AdminContext, action: string) {
  if (!(await ctx.can(`submissions:${action}`))) throw new FormsForbidden(`forbidden: submissions:${action}`);
}

const setStatus = (status: FormSubmission['status']) => async (id: string, _input: unknown, ctx: AdminContext) => {
  await need(ctx, 'update');
  const [row] = await getDb().update(formSubmissions).set({ status }).where(eq(formSubmissions.id, id)).returning();
  return row!;
};

export const submissionsAdminResource: AdminResource<FormSubmission> = {
  name: 'submissions',
  label: { singular: 'Submission', plural: 'Submissions' },
  group: 'Forms',
  fields: [
    { name: 'formKey', label: 'Form', type: 'text', readOnly: true, list: true },
    { name: 'status', label: 'Status', type: 'select', list: true, options: ['new', 'read', 'archived', 'spam'].map((v) => ({ value: v, label: v })) },
    { name: 'data', label: 'Data', type: 'json', readOnly: true },
    { name: 'sourcePath', label: 'Page', type: 'text', readOnly: true, list: true },
    { name: 'utm', label: 'Campaign', type: 'json', readOnly: true },
    { name: 'createdAt', label: 'Received', type: 'datetime', readOnly: true, list: true },
  ],
  input: z.object({}),
  title: (r) => `${r.formKey} · ${r.createdAt.toISOString().slice(0, 16).replace('T', ' ')}`,
  async list(q, ctx) {
    await need(ctx, 'read');
    const conds: SQL[] = [];
    if (q.filters?.form) conds.push(eq(formSubmissions.formKey, q.filters.form));
    if (q.filters?.status) conds.push(sql`${formSubmissions.status} = ${q.filters.status}`);
    if (q.search) conds.push(sql`${formSubmissions.data}::text ilike ${`%${q.search.replace(/[%_\\]/g, (m) => `\\${m}`)}%`}`);
    const where = conds.length ? and(...conds) : undefined;
    const [total] = await getDb().select({ n: count() }).from(formSubmissions).where(where);
    const rows = await getDb().select().from(formSubmissions).where(where).orderBy(desc(formSubmissions.createdAt)).limit(q.pageSize).offset((Math.max(q.page, 1) - 1) * q.pageSize);
    return { rows, total: total?.n ?? 0 };
  },
  async get(id, ctx) {
    await need(ctx, 'read');
    const [row] = await getDb().select().from(formSubmissions).where(eq(formSubmissions.id, id));
    return row ?? null;
  },
  async delete(id, ctx) {
    await need(ctx, 'delete');
    await getDb().delete(formSubmissions).where(eq(formSubmissions.id, id));
  },
  actions: [
    { name: 'read', label: 'Mark as read', permission: 'submissions:update', available: (r) => r.status === 'new', run: setStatus('read') },
    { name: 'archive', label: 'Archive', permission: 'submissions:update', run: setStatus('archived') },
    { name: 'spam', label: 'Mark as spam', permission: 'submissions:update', run: setStatus('spam') },
  ],
};

export const formsAdminResources = () => [submissionsAdminResource, contentAdminResource('forms')];

/** Neutraliza fórmulas al abrir el CSV en una hoja de cálculo (=, +, -, @, tab, CR). */
const cell = (v: unknown) => {
  let s = v === null || v === undefined ? '' : typeof v === 'string' ? v : JSON.stringify(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replaceAll('"', '""')}"`;
};

/** CSV de los envíos de un formulario (columnas: fecha, estado, página, campos…). Exige `submissions:export`. */
export async function exportSubmissionsCsv(formKey: string, ctx: AdminContext, db: Executor = getDb()): Promise<string> {
  await need(ctx, 'export');
  const rows = await db.select().from(formSubmissions).where(eq(formSubmissions.formKey, formKey)).orderBy(asc(formSubmissions.createdAt));
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r.data)))];
  const header = ['received', 'status', 'page', ...keys].map(cell).join(',');
  const lines = rows.map((r) => [r.createdAt.toISOString(), r.status, r.sourcePath, ...keys.map((k) => r.data[k])].map(cell).join(','));
  return [header, ...lines].join('\r\n');
}

/** Retención: borra envíos más antiguos que `days` (prográmalo con @core/jobs según tu política de privacidad). */
export async function pruneSubmissions(days: number, db: Executor = getDb()): Promise<number> {
  const rows = await db.delete(formSubmissions).where(lt(formSubmissions.createdAt, new Date(Date.now() - days * 86_400_000))).returning({ id: formSubmissions.id });
  return rows.length;
}

/** Derecho de supresión: borra los envíos que contienen este email en cualquier campo. */
export async function deleteSubmissionsByEmail(email: string, db: Executor = getDb()): Promise<number> {
  const e = email.trim().toLowerCase();
  const rows = await db
    .delete(formSubmissions)
    .where(sql`exists (select 1 from jsonb_each_text(${formSubmissions.data}) kv where lower(kv.value) = ${e})`)
    .returning({ id: formSubmissions.id });
  return rows.length;
}
