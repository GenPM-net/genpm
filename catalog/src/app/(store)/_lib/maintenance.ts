// Mantenimiento diario de la tienda (@core/jobs): borra carritos abandonados caducados.
// Se registra al importar `src/genpm/commerce.ts`; lo programa `(cms)/_scripts/setup-schedules.ts`.
import { z } from 'zod';
import { pruneCarts } from '@/lib/cart';
import { defineJob } from '@/lib/jobs';

export const storeMaintenanceJob = defineJob('store.maintenance', z.object({}), async () => {
  await pruneCarts();
});
