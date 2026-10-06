// Genera la migración de TODOS los módulos juntos (como en un proyecto con todos los kits) y la aplica en PGlite.
// Detecta tablas o índices con el mismo nombre en dos módulos y SQL que no se pueda ejecutar.
import { readdirSync, existsSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';

const root = new URL('../src/lib/', import.meta.url);
const schemas: Record<string, unknown> = {};
const owners = new Map<string, string>();
for (const mod of readdirSync(root)) {
  const file = new URL(`${mod}/schema.ts`, root);
  if (!existsSync(file)) continue;
  const exports = (await import(file.href)) as Record<string, unknown>;
  for (const [name, value] of Object.entries(exports)) {
    const table = value as { [k: symbol]: unknown };
    const sym = Object.getOwnPropertySymbols(table ?? {}).find((s) => s.description === 'drizzle:Name');
    if (!sym) continue;
    const sqlName = String(table[sym]);
    if (owners.has(sqlName) && owners.get(sqlName) !== mod) throw new Error(`table ${sqlName} defined in ${owners.get(sqlName)} and ${mod}`);
    owners.set(sqlName, mod);
    schemas[`${mod}_${name}`] = value;
  }
}
const { generateDrizzleJson, generateMigration } = await import('drizzle-kit/api');
const statements = await generateMigration(generateDrizzleJson({}), generateDrizzleJson(schemas));
const db = new PGlite({ extensions: { pg_trgm } });
for (const s of statements) await db.exec(s);
console.log(`✔ ${owners.size} tables from ${new Set(owners.values()).size} modules, ${statements.length} statements applied`);
