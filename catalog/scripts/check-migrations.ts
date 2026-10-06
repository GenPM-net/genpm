// Genera la migración de TODOS los módulos juntos (como en un proyecto con todos los kits) y la aplica en PGlite.
// Detecta tablas o índices con el mismo nombre en dos módulos y SQL que no se pueda ejecutar.
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { migrationStatements } from './all-schemas.ts';

const { statements, owners } = await migrationStatements();
const db = new PGlite({ extensions: { pg_trgm } });
for (const s of statements) await db.exec(s);
console.log(`✔ ${owners.size} tables from ${new Set(owners.values()).size} modules, ${statements.length} statements applied`);
