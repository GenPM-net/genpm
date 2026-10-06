// Programa las tareas periódicas del dropshipping en @core/jobs (idempotente).
// Uso (lo ejecuta la persona, con DATABASE_URL): npx tsx "src/app/(dropshipping)/_scripts/setup-schedules.ts"
import '@/genpm';
import { schedule } from '@/lib/jobs';

export async function setupSchedules(): Promise<void> {
  await schedule('suppliers.sync', process.env.SUPPLIERS_SYNC_CRON ?? '0 */6 * * *'); // coste y stock cada 6 h
  await schedule('suppliers.tracking', process.env.SUPPLIERS_TRACKING_CRON ?? '0 */12 * * *'); // seguimiento cada 12 h
}

if (process.argv[1]?.endsWith('setup-schedules.ts')) {
  await setupSchedules();
  console.log('Scheduled suppliers.sync (every 6 h) and suppliers.tracking (every 12 h). Make sure /api/cron runs every minute.');
  process.exit(0);
}
