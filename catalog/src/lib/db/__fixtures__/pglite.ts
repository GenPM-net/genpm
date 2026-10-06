// Solo tests (excluido de la inyección por .genpmignore): Postgres real en WASM con PGlite y las tablas de los
// esquemas que se pasen, generadas con drizzle-kit igual que en una migración.
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { type Db, setDb } from '../client.js';

export async function testDb(...schemas: Array<Record<string, unknown>>): Promise<Db> {
  const { generateDrizzleJson, generateMigration } = await import('drizzle-kit/api');
  const schema = Object.assign({}, ...schemas) as Record<string, unknown>;
  const statements = await generateMigration(generateDrizzleJson({}), generateDrizzleJson(schema));
  const client = new PGlite();
  for (const s of statements) await client.exec(s);
  const db = drizzle(client) as unknown as Db;
  setDb(db);
  return db;
}
