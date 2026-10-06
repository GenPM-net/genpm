// Mantenimiento diario del sitio (@core/jobs): borra contadores de rate limit caducados y tareas terminadas antiguas.
// Lo importa `api/cron`, así que el tipo de tarea existe en el proceso que la ejecuta.
import { z } from 'zod';
import { pruneRateLimits } from '@/lib/antispam';
import { defineJob, pruneJobs } from '@/lib/jobs';

export const maintenanceJob = defineJob('cms.maintenance', z.object({}), async () => {
  await pruneRateLimits();
  await pruneJobs(7);
});
