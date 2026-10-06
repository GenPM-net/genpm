// Programa las tareas periódicas del CMS en @core/jobs y construye el índice de búsqueda la primera vez (idempotente).
// Uso (lo ejecuta la persona, con DATABASE_URL): npx tsx "src/app/(cms)/_scripts/setup-schedules.ts"
import '@/genpm';
import { schedule } from '@/lib/jobs';
import { reindexJob } from '@/lib/search';
import { maintenanceJob } from '../_lib/maintenance';

export async function setupSchedules(): Promise<void> {
  await schedule(maintenanceJob.type, '30 3 * * *'); // rate limits y tareas antiguas
  await schedule(reindexJob.type, '0 3 * * *'); // el índice se mantiene al publicar; esto lo reconstruye por si acaso
  await reindexJob.enqueue({});
}

if (process.argv[1]?.endsWith('setup-schedules.ts')) {
  await setupSchedules();
  console.log('Scheduled cms.maintenance and search.reindex (daily) and queued a first reindex. Make sure /api/cron runs every minute.');
  process.exit(0);
}
