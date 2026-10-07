// Cliente de base de datos. Un único `Db` para toda la app, creado perezosamente desde DATABASE_URL.
// El tipo es el `PgDatabase` genérico de Drizzle: cualquier driver Postgres (postgres-js, Neon, PGlite…) sirve.
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT, PgTransaction } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

export type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;
export type Tx = PgTransaction<PgQueryResultHKT, Record<string, never>, ExtractTablesWithRelations<Record<string, never>>>;
/** Cualquier cosa sobre la que se pueden lanzar consultas: la BD o una transacción en curso. */
export type Executor = Db | Tx;

let current: Db | null = null;

/** Crea un cliente Postgres. `max` bajo por defecto: pensado para serverless y desarrollo. */
export function createDb(url: string | undefined = process.env.DATABASE_URL, opts: { max?: number } = {}): Db {
  if (!url) throw new Error('DATABASE_URL is not set (see .env.example)');
  const sql = postgres(url, { max: opts.max ?? 5, prepare: false });
  return drizzle(sql) as unknown as Db;
}

/** El cliente compartido de la app. */
export function getDb(): Db {
  current ??= createDb();
  return current;
}

/** Sustituye el cliente compartido (tests, o un driver distinto como PGlite o Neon). */
export function setDb(db: Db): void {
  current = db;
}
