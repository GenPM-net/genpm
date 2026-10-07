// Solo tests (excluido de la inyección por .genpmignore): Postgres real en WASM con PGlite y las tablas de los
// esquemas que se pasen, generadas con drizzle-kit igual que en una migración.
// Con TEST_DATABASE_URL, los mismos tests corren contra un Postgres de verdad con postgres-js (el driver de
// producción): cada llamada crea un esquema nuevo y aislado. Así se detectan diferencias entre drivers.
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { type Db, setDb } from '../client.ts';

let previous: { sql: postgres.Sql; schema: string } | null = null;

export async function testDb(...schemas: Array<Record<string, unknown>>): Promise<Db> {
  const { generateDrizzleJson, generateMigration } = await import('drizzle-kit/api');
  const schema = Object.assign({}, ...schemas) as Record<string, unknown>;
  const statements = await generateMigration(generateDrizzleJson({}), generateDrizzleJson(schema));
  const url = process.env.TEST_DATABASE_URL;
  if (url) {
    if (previous) {
      const { sql: old, schema: oldSchema } = previous;
      await old.unsafe(`drop schema if exists ${oldSchema} cascade`).catch(() => {});
      await old.end();
    }
    const name = `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const sql = postgres(url, { max: 3, prepare: false, onnotice: () => {}, connection: { search_path: `${name}, public` } });
    await sql.unsafe(`create schema ${name}`);
    // drizzle-kit califica tablas, claves foráneas y secuencias con "public".
    for (const s of statements) await sql.unsafe(s.replaceAll('"public".', `"${name}".`));
    previous = { sql, schema: name };
    const db = drizzlePg(sql) as unknown as Db;
    setDb(db);
    return db;
  }
  const client = new PGlite();
  for (const s of statements) await client.exec(s);
  const db = drizzle(client) as unknown as Db;
  setDb(db);
  return db;
}
