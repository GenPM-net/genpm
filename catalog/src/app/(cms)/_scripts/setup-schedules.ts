// Programa las tareas periódicas de los kits instalados en @core/jobs y construye el índice de búsqueda la primera vez
// (idempotente: se puede repetir tras instalar otro kit). Solo programa las tareas que el proyecto registra.
// Uso (lo ejecuta la persona, con DATABASE_URL): npx tsx "src/app/(cms)/_scripts/setup-schedules.ts"
import '@/genpm';
import { getJob, schedule } from '@/lib/jobs';
import { reindexJob } from '@/lib/search';
import '../_lib/maintenance';

/** Tarea → cron (UTC). Las de kits no instalados se omiten. */
export const SCHEDULES: Record<string, string> = {
  'cms.maintenance': '30 3 * * *', // rate limits y tareas antiguas
  'search.reindex': '0 3 * * *', // el índice se mantiene al publicar; esto lo reconstruye por si acaso
  'store.maintenance': '45 3 * * *', // kit-store: carritos caducados
  'experiments.prune': '15 4 * * *', // kit-landing: participantes de experimentos parados
};

export async function setupSchedules(): Promise<string[]> {
  const done: string[] = [];
  for (const [type, cron] of Object.entries(SCHEDULES)) {
    if (!getJob(type)) continue;
    await schedule(type, cron);
    done.push(type);
  }
  await reindexJob.enqueue({});
  return done;
}

// Sin top-level await: tsx compila a CommonJS en proyectos sin "type": "module" (lo normal en Next).
if (process.argv[1]?.endsWith('setup-schedules.ts')) {
  setupSchedules().then((done) => {
    console.log(`Scheduled daily: ${done.join(', ')}; queued a first reindex. Make sure /api/cron runs every minute.`);
    process.exit(0);
  }, (e) => {
    console.error(e);
    process.exit(1);
  });
}
