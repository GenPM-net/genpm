// Columnas estándar para que todas las tablas de todos los módulos se parezcan.
import { text, timestamp } from 'drizzle-orm/pg-core';
import { newId } from './ulid.js';

/** Clave primaria `text` con ULID prefijado generado en la app: `id: primaryId('usr')`. */
export const primaryId = (prefix: string) =>
  text('id')
    .primaryKey()
    .$defaultFn(() => newId(prefix));

/** `created_at` / `updated_at` con zona horaria; `updated_at` se actualiza solo en cada `update()`. */
export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
};
