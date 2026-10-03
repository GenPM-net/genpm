// App Hono del registry (api-spec §4). `index.ts` la exporta junto al handler `scheduled`.

import { Hono } from 'hono';
import type { AppEnv } from './env.js';
import { bodyLimit, cors, locale, requestId, securityHeaders } from './middleware/base.js';
import { notFound, onError } from './middleware/problem.js';
import { tenant } from './middleware/tenant.js';
import { health } from './routes/health.js';

export function createApp() {
  const app = new Hono<AppEnv>();
  app.use('*', requestId, securityHeaders, locale, cors, bodyLimit);
  app.route('/v1/health', health);
  app.use('/v1/*', tenant);
  app.onError(onError);
  app.notFound(notFound);
  return app;
}
