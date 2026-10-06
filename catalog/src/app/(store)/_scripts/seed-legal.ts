// Crea las páginas legales de la tienda como borradores pendientes de revisión.
// Uso (lo ejecuta la persona, con DATABASE_URL): npx tsx "src/app/(store)/_scripts/seed-legal.ts"
import '@/genpm';
import { seedLegalPages } from '../_lib/legal';

const created = await seedLegalPages();
console.log(created.length ? `Draft legal pages created: ${created.map((s) => `/${s}`).join(', ')}. Complete and review them before publishing.` : 'Legal pages already exist.');
process.exit(0);
