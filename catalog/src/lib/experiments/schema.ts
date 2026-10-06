// Tablas de @core/experiments. Las recoge drizzle-kit vía src/lib/db/drizzle.config.ts.
import { index, jsonb, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from '../db/index.js';

export type ExperimentVariant = { key: string; weight: number };

export const experiments = pgTable('experiments', {
  id: primaryId('exp'),
  /** Clave estable usada en el código (`getVariant('hero-test')`). */
  key: text('key').notNull().unique(),
  name: text('name').notNull(),
  status: text('status', { enum: ['draft', 'running', 'stopped'] }).notNull().default('draft'),
  /** La primera variante es el control. */
  variants: jsonb('variants').$type<ExperimentVariant[]>().notNull(),
  /** Objetivo de conversión (`lead`, `purchase`, `click`… lo decide quien llama a `recordConversion`). */
  goal: text('goal').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }),
  stoppedAt: timestamp('stopped_at', { withTimezone: true, mode: 'date' }),
  /** Resultados congelados al parar (los participantes se borran después). */
  results: jsonb('results').$type<unknown[]>(),
  ...timestamps,
});

/**
 * Participantes con consentimiento de analítica: seudónimo (HMAC del id de consentimiento), variante y si convirtió.
 * Sin datos personales; se borran 30 días después de parar el experimento (`pruneExperimentsJob`).
 */
export const experimentParticipants = pgTable(
  'experiment_participants',
  {
    experimentId: text('experiment_id')
      .notNull()
      .references(() => experiments.id, { onDelete: 'cascade' }),
    visitor: text('visitor').notNull(),
    variant: text('variant').notNull(),
    exposedAt: timestamp('exposed_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    convertedAt: timestamp('converted_at', { withTimezone: true, mode: 'date' }),
  },
  (t) => [primaryKey({ columns: [t.experimentId, t.visitor] }), index('experiment_participants_variant_idx').on(t.experimentId, t.variant)],
);

export type Experiment = typeof experiments.$inferSelect;
