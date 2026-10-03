import { createApp } from './app.js';
import type { Env, ScanJob } from './env.js';

const app = createApp();

export default {
  fetch: app.fetch,
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const { runCron } = await import('./cron/index.js');
    ctx.waitUntil(runCron(controller.cron, env));
  },
  async queue(batch: MessageBatch<ScanJob>, env: Env): Promise<void> {
    const { consumeScanBatch } = await import('./services/scan-queue.js');
    await consumeScanBatch(batch, env);
  },
} satisfies ExportedHandler<Env, ScanJob>;
