// Tablas de @core/consent. Las recoge drizzle-kit vía src/lib/db/drizzle.config.ts.
import { index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { primaryId } from '../db/index.js';

/** Prueba del consentimiento (RGPD art. 7.1): qué se eligió, con qué versión de la política y cuándo. Sin IP. */
export const consentRecords = pgTable(
  'consent_records',
  {
    id: primaryId('cns'),
    /** Id aleatorio del navegador (en la cookie); no identifica a la persona. */
    subjectId: text('subject_id').notNull(),
    choices: jsonb('choices').$type<Record<string, boolean>>().notNull(),
    policyVersion: text('policy_version').notNull(),
    /** `banner`, `preferences`, `withdraw`. */
    action: text('action').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [index('consent_records_subject_idx').on(t.subjectId, t.createdAt)],
);
