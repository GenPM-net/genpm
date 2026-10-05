// App Hono del registry (api-spec §4). `index.ts` la exporta junto a los handlers `scheduled` y `queue`.

import { Hono } from 'hono';
import type { AppEnv } from './env.js';
import { httpError } from './http.js';
import { bodyLimit, cors, locale, requestId, securityHeaders } from './middleware/base.js';
import { notFound, onError } from './middleware/problem.js';
import { rateLimit } from './middleware/rate-limit.js';
import { tenant } from './middleware/tenant.js';
import { leads, myPackages, reports, tokens } from './routes/account.js';
import { admin } from './routes/admin.js';
import { archive } from './routes/archive.js';
import { auth, me } from './routes/auth.js';
import { advisories, badge, featured, scopes, stats } from './routes/discovery.js';
import { health } from './routes/health.js';
import { keys } from './routes/keys.js';
import { compare, deprecate, mePrefs, status } from './routes/manage.js';
import { myRepos } from './routes/my-repos.js';
import { packages } from './routes/packages.js';
import { publish } from './routes/publish.js';
import { resolve } from './routes/resolve.js';
import { search } from './routes/search.js';
import { oidc, trusted } from './routes/trusted.js';
import { yank } from './routes/yank.js';

export function createApp() {
  const app = new Hono<AppEnv>();
  // Siempre HTTPS (el CLI ya usa https; esto cubre navegadores y scripts). El Service Binding y los tests no aplican.
  app.use('*', async (c, next) => {
    const url = new URL(c.req.url);
    if (url.protocol === 'http:' && url.hostname.endsWith('genpm.net')) {
      url.protocol = 'https:';
      return c.redirect(url.toString(), c.req.method === 'GET' || c.req.method === 'HEAD' ? 301 : 308);
    }
    await next();
  });
  app.use('*', requestId, securityHeaders, locale, cors, bodyLimit);
  app.route('/v1/health', health);
  app.route('/v1/status', status);
  app.use('/v1/*', tenant);
  // Contención de incidentes (security §9, runbook §3): con READ_ONLY=1 se puede leer e instalar, nunca escribir.
  app.use('/v1/*', async (c, next) => {
    if (c.env.READ_ONLY === '1' && !['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) throw httpError('E_READ_ONLY');
    return next();
  });
  app.use('/v1/*', async (c, next) => {
    // Las clases específicas (publish, auth exchange) se aplican en sus rutas.
    if (
      c.req.path === '/v1/publish' ||
      c.req.path === '/v1/auth/github/exchange' ||
      c.req.path === '/v1/auth/oidc/exchange'
    )
      return next();
    return rateLimit()(c, next);
  });
  app.route('/v1/keys', keys);
  app.route('/v1/search', search);
  app.route('/v1/resolve', resolve);
  app.route('/v1/archive', archive);
  app.route('/v1/packages', yank);
  app.route('/v1/packages', deprecate);
  app.route('/v1/packages', compare);
  app.route('/v1/packages', packages);
  app.route('/v1/publish', publish);
  app.route('/v1/auth', auth);
  app.route('/v1/auth', oidc);
  app.route('/v1/scopes', trusted);
  app.route('/v1/featured', featured);
  app.route('/v1/stats', stats);
  app.route('/v1/scopes', scopes);
  app.route('/v1/badge', badge);
  app.route('/v1/advisories', advisories);
  app.route('/v1/me/repos', myRepos);
  app.route('/v1/me', myPackages);
  app.route('/v1/me', me);
  app.route('/v1/me', mePrefs);
  app.route('/v1/tokens', tokens);
  app.route('/v1/reports', reports);
  app.route('/v1/leads', leads);
  app.route('/v1/admin', admin);
  app.onError(onError);
  app.notFound(notFound);
  return app;
}
