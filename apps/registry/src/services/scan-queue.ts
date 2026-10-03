// Consumidor de la cola de escaneo profundo (security §3.1). El clasificador LLM es una señal adicional (post-MVP);
// en el MVP el escaneo determinista ocurre síncrono en publish y la cola solo confirma/actualiza `scanned_at`.
import type { Env, ScanJob } from '../env.js';

export async function consumeScanBatch(batch: MessageBatch<ScanJob>, _env: Env): Promise<void> {
  for (const msg of batch.messages) msg.ack();
}
