// Arranque de la base de datos: Postgres real con DATABASE_URL, o PGlite (Postgres en WASM) si empieza por `pglite:`.
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { type Db, setDb } from './lib/db/index.js';

export async function initDb(url = process.env.DATABASE_URL ?? 'pglite:memory'): Promise<void> {
  if (!url.startsWith('pglite:')) return; // getDb() crea el cliente postgres-js perezosamente
  const dir = url.slice('pglite:'.length);
  const client = new PGlite(dir === 'memory' ? undefined : dir);
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: './drizzle' });
  setDb(db as unknown as Db);
}
