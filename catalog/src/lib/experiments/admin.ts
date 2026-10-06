// Recurso "Experimentos" para @core/admin: crear, empezar, parar y ver resultados con significación.
import { count, desc, eq } from 'drizzle-orm';
import type { AdminContext, AdminResource } from '../contracts/index.js';
import { getDb } from '../db/index.js';
import { ExperimentError, ExperimentInput, experimentResults, setExperimentStatus, upsertExperiment, type VariantResult } from './experiments.js';
import { type Experiment, experiments } from './schema.js';

export type ExperimentAdminRow = Experiment & { summary: string; current: VariantResult[] };

async function need(ctx: AdminContext, p: string) {
  if (!(await ctx.can(p))) throw new ExperimentError('forbidden', `forbidden: ${p}`);
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
/** Resumen legible: tasa por variante y, frente al control, mejora, p-valor y si es significativo. */
export function summarize(results: VariantResult[]): string {
  return results
    .map((r) =>
      r.vsControl
        ? `${r.variant}: ${pct(r.rate)} (${r.conversions}/${r.participants}) · ${r.vsControl.lift === null ? '—' : `${r.vsControl.lift >= 0 ? '+' : ''}${pct(r.vsControl.lift)}`} · p=${r.vsControl.pValue.toFixed(3)}${r.vsControl.significant ? ' · significant' : ' · not significant yet'}`
        : `${r.variant} (control): ${pct(r.rate)} (${r.conversions}/${r.participants})`,
    )
    .join('\n');
}

async function row(e: Experiment): Promise<ExperimentAdminRow> {
  const current = e.status === 'draft' ? [] : await experimentResults(e.id);
  return { ...e, current, summary: current.length ? summarize(current) : 'Not started' };
}

export const experimentsAdminResource: AdminResource<ExperimentAdminRow> = {
  name: 'experiments',
  label: { singular: 'Experiment', plural: 'Experiments' },
  group: 'Marketing',
  fields: [
    { name: 'name', label: 'Name', type: 'text', required: true, list: true },
    { name: 'key', label: 'Key (used in code)', type: 'slug', required: true, list: true },
    { name: 'goal', label: 'Goal (e.g. lead, purchase)', type: 'text', required: true, list: true },
    {
      name: 'variants',
      label: 'Variants (the first one is the control)',
      type: 'list',
      required: true,
      fields: [
        { name: 'key', label: 'Key (a, b…)', type: 'text', required: true },
        { name: 'weight', label: 'Traffic weight', type: 'number' },
      ],
    },
    { name: 'status', label: 'Status', type: 'text', readOnly: true, list: true },
    { name: 'summary', label: 'Results', type: 'textarea', readOnly: true, help: 'Decide only when the result is significant and the test ran full weeks.' },
  ],
  input: ExperimentInput,
  title: (e) => e.name,
  async list(q, ctx) {
    await need(ctx, 'experiments:read');
    const [total] = await getDb().select({ n: count() }).from(experiments);
    const rows = await getDb().select().from(experiments).orderBy(desc(experiments.createdAt)).limit(q.pageSize).offset((Math.max(q.page, 1) - 1) * q.pageSize);
    return { rows: await Promise.all(rows.map(row)), total: total?.n ?? 0 };
  },
  async get(id, ctx) {
    await need(ctx, 'experiments:read');
    const [e] = await getDb().select().from(experiments).where(eq(experiments.id, id));
    return e ? row(e) : null;
  },
  async create(input, ctx) {
    await need(ctx, 'experiments:create');
    return row(await upsertExperiment(input as never));
  },
  async update(id, input, ctx) {
    await need(ctx, 'experiments:update');
    return row(await upsertExperiment(input as never, id));
  },
  actions: [
    {
      name: 'start',
      label: 'Start',
      permission: 'experiments:update',
      confirm: true,
      available: (e) => e.status === 'draft',
      async run(id, _i, ctx) {
        await need(ctx, 'experiments:update');
        return row(await setExperimentStatus(id, 'running'));
      },
    },
    {
      name: 'stop',
      label: 'Stop and keep results',
      permission: 'experiments:update',
      confirm: true,
      available: (e) => e.status === 'running',
      async run(id, _i, ctx) {
        await need(ctx, 'experiments:update');
        return row(await setExperimentStatus(id, 'stopped'));
      },
    },
  ],
};
