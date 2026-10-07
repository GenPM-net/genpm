// Esquemas Drizzle de TODOS los módulos (como en un proyecto con todos los kits) y la migración que los crea desde cero.
// Lo usan check-migrations.ts (PGlite) y el e2e (Postgres real).
import { existsSync, readdirSync } from 'node:fs';

export async function allSchemas(): Promise<{ schemas: Record<string, unknown>; owners: Map<string, string> }> {
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
  return { schemas, owners };
}

export async function migrationStatements(): Promise<{ statements: string[]; owners: Map<string, string> }> {
  const { schemas, owners } = await allSchemas();
  const { generateDrizzleJson, generateMigration } = await import('drizzle-kit/api');
  return { statements: await generateMigration(generateDrizzleJson({}), generateDrizzleJson(schemas)), owners };
}
