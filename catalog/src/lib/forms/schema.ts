// Tablas de @core/forms. Las recoge drizzle-kit vía src/lib/db/drizzle.config.ts.
import { index, jsonb, pgTable, text } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from '../db/index.js';

export const formSubmissions = pgTable(
  'form_submissions',
  {
    id: primaryId('sub'),
    formKey: text('form_key').notNull(),
    data: jsonb('data').$type<Record<string, unknown>>().notNull(),
    /** Versión del texto de consentimiento aceptado (prueba RGPD), si el formulario lo pide. */
    consentVersion: text('consent_version'),
    /** Página desde la que se envió (sin query) y parámetros de campaña capturados. */
    sourcePath: text('source_path'),
    utm: jsonb('utm').$type<Record<string, string>>(),
    status: text('status', { enum: ['new', 'read', 'archived', 'spam'] })
      .notNull()
      .default('new'),
    ...timestamps,
  },
  (t) => [index('form_submissions_form_idx').on(t.formKey, t.createdAt)],
);

export type FormSubmission = typeof formSubmissions.$inferSelect;
