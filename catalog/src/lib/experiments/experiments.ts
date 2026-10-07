// Tests A/B: asignación estable por visitante (solo con consentimiento de analítica; sin él, siempre el control y sin
// registrar nada), conversión por objetivo y resultados con significación estadística.
import { and, count, eq, isNull, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getConsent } from '../consent/index.ts';
import { type Executor, getDb } from '../db/index.ts';
import { defineJob } from '../jobs/index.ts';
import { type Experiment, type ExperimentVariant, experimentParticipants, experiments } from './schema.ts';
import { type Comparison, compare } from './stats.ts';

export class ExperimentError extends Error {
  constructor(
    readonly code: 'invalid' | 'not_found' | 'invalid_state' | 'forbidden',
    message: string = code,
  ) {
    super(message);
  }
}

const Key = z.string().regex(/^[a-z][a-z0-9-]{1,47}$/);
export const ExperimentInput = z.object({
  key: Key,
  name: z.string().trim().min(1).max(120),
  goal: z.string().regex(/^[a-z][a-z0-9_-]{1,39}$/),
  variants: z
    .array(z.object({ key: z.string().regex(/^[a-z0-9][a-z0-9-]{0,23}$/), weight: z.coerce.number().int().min(1).max(100).default(50) }))
    .min(2)
    .max(5)
    .refine((v) => new Set(v.map((x) => x.key)).size === v.length, 'Variant keys must be unique'),
});

export async function upsertExperiment(input: z.input<typeof ExperimentInput>, id?: string, db: Executor = getDb()): Promise<Experiment> {
  const data = ExperimentInput.parse(input);
  if (id) {
    const [cur] = await db.select().from(experiments).where(eq(experiments.id, id));
    if (!cur) throw new ExperimentError('not_found');
    // Cambiar variantes o pesos con el experimento en marcha invalidaría los resultados.
    if (cur.status !== 'draft' && JSON.stringify(cur.variants) !== JSON.stringify(data.variants)) throw new ExperimentError('invalid_state', 'variants can only change while the experiment is a draft');
    const [row] = await db.update(experiments).set(data).where(eq(experiments.id, id)).returning();
    return row!;
  }
  const [row] = await db.insert(experiments).values(data).returning();
  return row!;
}

export async function setExperimentStatus(id: string, status: 'running' | 'stopped', db: Executor = getDb()): Promise<Experiment> {
  const [cur] = await db.select().from(experiments).where(eq(experiments.id, id));
  if (!cur) throw new ExperimentError('not_found');
  if (status === 'running' && cur.status !== 'draft') throw new ExperimentError('invalid_state', 'only draft experiments can start (results would mix otherwise)');
  if (status === 'stopped' && cur.status !== 'running') throw new ExperimentError('invalid_state', 'only running experiments can stop');
  const [row] = await db
    .update(experiments)
    .set(status === 'running' ? { status, startedAt: new Date() } : { status, stoppedAt: new Date(), results: await experimentResults(id, db) })
    .where(eq(experiments.id, id))
    .returning();
  return row!;
}

function secret(): string {
  const s = process.env.EXPERIMENTS_SECRET;
  if (!s || s.length < 32) throw new Error('EXPERIMENTS_SECRET must be set (>= 32 chars)');
  return s;
}

async function hmac(data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data)));
}
const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');

/** Variante por peso a partir de un número 0–9999 (determinista). */
/** Cubeta 0–9999 a partir de los 32 primeros bits del HMAC (con 16 bits, `% 10 000` sesgaba las cubetas bajas). */
export const bucketOf = (h: Uint8Array): number => new DataView(h.buffer, h.byteOffset, h.byteLength).getUint32(0) % 10_000;

export function pickVariant(variants: ExperimentVariant[], bucket: number): string {
  const total = variants.reduce((s, v) => s + v.weight, 0);
  let acc = 0;
  for (const v of variants) {
    acc += (v.weight / total) * 10_000;
    if (bucket < acc) return v.key;
  }
  return variants.at(-1)!.key;
}

/** Seudónimo del visitante: HMAC de su id de consentimiento (solo si aceptó analítica). */
async function visitorOf(cookieHeader: string | null | undefined): Promise<string | null> {
  const c = getConsent(cookieHeader);
  return c.choices.analytics && c.subjectId ? hex(await hmac(`visitor:${c.subjectId}`)) : null;
}

export type Assignment = { variant: string; control: boolean; tracked: boolean };

/**
 * Variante para este visitante. Sin consentimiento de analítica, con el experimento parado o inexistente: el control,
 * sin registrar nada. Con consentimiento: siempre la misma variante para la misma persona, y se registra su exposición.
 */
export async function getVariant(key: string, cookieHeader: string | null | undefined, db: Executor = getDb()): Promise<Assignment> {
  const [e] = await db.select().from(experiments).where(eq(experiments.key, key));
  const control = e?.variants[0]?.key ?? 'control';
  if (!e || e.status !== 'running') return { variant: control, control: true, tracked: false };
  const visitor = await visitorOf(cookieHeader);
  if (!visitor) return { variant: control, control: true, tracked: false };
  const h = await hmac(`bucket:${key}:${visitor}`);
  const variant = pickVariant(e.variants, bucketOf(h));
  await db.insert(experimentParticipants).values({ experimentId: e.id, visitor, variant }).onConflictDoNothing();
  // Si ya participaba (p. ej. tras cambiar pesos en borrador), manda lo registrado.
  const [p] = await db.select({ variant: experimentParticipants.variant }).from(experimentParticipants).where(and(eq(experimentParticipants.experimentId, e.id), eq(experimentParticipants.visitor, visitor)));
  const v = p?.variant ?? variant;
  return { variant: v, control: v === control, tracked: true };
}

/** Marca la conversión (una vez) en los experimentos en marcha con ese objetivo en los que participa el visitante. */
export async function recordConversion(goal: string, cookieHeader: string | null | undefined, db: Executor = getDb()): Promise<number> {
  const visitor = await visitorOf(cookieHeader);
  if (!visitor) return 0;
  const rows = await db
    .update(experimentParticipants)
    .set({ convertedAt: new Date() })
    .where(
      and(
        eq(experimentParticipants.visitor, visitor),
        isNull(experimentParticipants.convertedAt),
        sql`${experimentParticipants.experimentId} in (select ${experiments.id} from ${experiments} where ${experiments.status} = 'running' and ${experiments.goal} = ${goal})`,
      ),
    )
    .returning({ id: experimentParticipants.experimentId });
  return rows.length;
}

export type VariantResult = { variant: string; participants: number; conversions: number; rate: number; vsControl: Comparison | null };

export async function experimentResults(id: string, db: Executor = getDb()): Promise<VariantResult[]> {
  const [e] = await db.select().from(experiments).where(eq(experiments.id, id));
  if (!e) throw new ExperimentError('not_found');
  if (e.status === 'stopped' && e.results) return e.results as VariantResult[];
  const rows = await db
    .select({ variant: experimentParticipants.variant, n: count(), conversions: sql<number>`count(${experimentParticipants.convertedAt})`.mapWith(Number) })
    .from(experimentParticipants)
    .where(eq(experimentParticipants.experimentId, id))
    .groupBy(experimentParticipants.variant);
  const of = (k: string) => rows.find((r) => r.variant === k) ?? { n: 0, conversions: 0 };
  const control = of(e.variants[0]!.key);
  return e.variants.map((v, i) => {
    const r = of(v.key);
    return {
      variant: v.key,
      participants: r.n,
      conversions: r.conversions,
      rate: r.n ? r.conversions / r.n : 0,
      vsControl: i === 0 ? null : compare({ n: control.n, conversions: control.conversions }, { n: r.n, conversions: r.conversions }),
    };
  });
}

/** Borra los participantes de experimentos parados hace más de `days` días (los resultados se guardan antes). */
export async function pruneParticipants(days = 30, db: Executor = getDb()): Promise<number> {
  const old = db.select({ id: experiments.id }).from(experiments).where(and(eq(experiments.status, 'stopped'), lt(experiments.stoppedAt, new Date(Date.now() - days * 86_400_000))));
  const rows = await db.delete(experimentParticipants).where(sql`${experimentParticipants.experimentId} in (${old})`).returning({ id: experimentParticipants.experimentId });
  return rows.length;
}

export const pruneExperimentsJob = defineJob('experiments.prune', z.object({ days: z.number().int().min(1).optional() }), async ({ days }) => {
  await pruneParticipants(days);
});
