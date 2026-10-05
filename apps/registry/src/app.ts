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
import { billing, sponsorships } from './routes/billing.js';
import { advisories, badge, featured, scopes, stats } from './routes/discovery.js';
import { health } from './routes/health.js';
import { keys } from './routes/keys.js';
import { compare, deprecate, mePrefs, policy, status } from './routes/manage.js';
import { mcpRoutes } from './routes/mcp.js';
import { myRepos } from './routes/my-repos.js';
import { packages } from './routes/packages.js';
import { publish } from './routes/publish.js';
import { access, registries, teams } from './routes/rbac.js';
import { recipes } from './routes/recipes.js';
import { resolve } from './routes/resolve.js';
import { scim } from './routes/scim.js';
import { search } from './routes/search.js';
import { sso, ssoAuth } from './routes/sso.js';
import { oidc, trusted } from './routes/trusted.js';
import { yank } from './routes/yank.js';
import { isOwnHost } from './services/domains.js';

export function createApp() {
  const app = new Hono<AppEnv>();
  // Siempre HTTPS (el CLI ya usa https; esto cubre navegadores y scripts). El Service Binding y los tests no aplican.
  // En `wrangler dev` la URL llega reescrita al host de la primera ruta (http://api.genpm.net) aunque el cliente use
  // http://localhost: redirigir ahí crearía un bucle 301 infinito, así que en desarrollo no se fuerza.
  app.use('*', async (c, next) => {
    const url = new URL(c.req.url);
    if (url.protocol === 'http:' && url.hostname.endsWith('genpm.net') && c.env.ENVIRONMENT !== 'development') {
      url.protocol = 'https:';
      return c.redirect(url.toString(), c.req.method === 'GET' || c.req.method === 'HEAD' ? 301 : 308);
    }
    await next();
  });
  // MCP remoto de solo lectura (V03-04): raíz de mcp.genpm.net y /mcp del API. Sus tools son subpeticiones a la propia
  // API pública con la IP del cliente (mismo rate limit y caché) y el tenant que pidió.
  const mcp = mcpRoutes((c, path) => {
    const headers = new Headers({ accept: 'application/json' });
    for (const h of ['cf-connecting-ip', 'genpm-registry', 'accept-language']) {
      const v = c.req.header(h);
      if (v) headers.set(h, v);
    }
    return Promise.resolve(app.request(new URL(path, c.req.url).toString(), { headers }, c.env, c.executionCtx));
  });
  // Registros privados por ruta (V10-01): `https://api.genpm.net/r/acme/v1/…` ≡ `genpm-registry: acme`. Es la URL que
  // va en `.genpmrc`, así el CLI no necesita saber nada de tenants.
  app.use('/r/*', async (c) => {
    const url = new URL(c.req.url);
    const m = url.pathname.match(/^\/r\/([a-z0-9][a-z0-9-]{0,38})(\/.*)?$/);
    if (!m || m[1] === 'public') throw httpError('E_NOT_FOUND', { name: url.pathname });
    url.pathname = m[2] ?? '/';
    const headers = new Headers(c.req.raw.headers);
    headers.set('genpm-registry', m[1]!);
    return app.fetch(new Request(url, { method: c.req.method, headers, body: c.req.raw.body }), c.env, c.executionCtx);
  });
  // Dominio propio de un registro (V10-03): `https://packages.acme.com/v1/…` ≡ `/r/<slug>/v1/…`.
  app.use('*', async (c, next) => {
    const host = new URL(c.req.url).hostname;
    if (isOwnHost(host) || c.req.header('genpm-registry')) return next();
    const row = await c.env.DB.prepare('SELECT slug FROM registries WHERE custom_domain = ?1')
      .bind(host)
      .first<{ slug: string }>();
    if (!row) throw httpError('E_NOT_FOUND', { name: host });
    const headers = new Headers(c.req.raw.headers);
    headers.set('genpm-registry', row.slug);
    return app.fetch(new Request(c.req.raw, { headers }), c.env, c.executionCtx);
  });
  app.use('*', async (c, next) => {
    const url = new URL(c.req.url);
    if (url.hostname.startsWith('mcp.') && url.pathname === '/') {
      url.pathname = '/mcp';
      return app.fetch(new Request(url, c.req.raw), c.env, c.executionCtx);
    }
    await next();
  });
  app.use('/mcp', requestId, securityHeaders, bodyLimit);
  app.route('/mcp', mcp);
  app.use('*', requestId, securityHeaders, locale, cors, bodyLimit);
  // Cron de un Worker dedicado (ENT-01), reenviado por el compartido: solo con CRON_SECRET y solo en modo dedicado.
  app.post('/__cron', async (c) => {
    if (!c.env.DEDICATED_TENANT || !c.env.CRON_SECRET || c.req.header('x-genpm-cron') !== c.env.CRON_SECRET)
      throw httpError('E_NOT_FOUND', { name: '/__cron' });
    const { cron } = (await c.req.json().catch(() => ({}))) as { cron?: string };
    const { runCron } = await import('./cron/index.js');
    await runCron(String(cron ?? ''), c.env);
    return c.json({ ok: true });
  });
  // SCIM 2.0 (ENT-02): fuera de /v1 (ruta estándar que configura el IdP), con su propio token y rate limit.
  app.use('/scim/*', rateLimit('auth'));
  app.route('/scim/v2', scim);
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
  app.route('/v1/packages', access);
  app.route('/v1/packages', packages);
  app.route('/v1/publish', publish);
  app.route('/v1/auth', auth);
  app.route('/v1/auth', oidc);
  app.route('/v1/auth', ssoAuth);
  app.route('/v1/scopes', trusted);
  app.route('/v1/recipes', recipes);
  app.route('/v1/policy', policy);
  app.route('/v1/billing', billing);
  app.route('/v1/sponsorships', sponsorships);
  app.route('/v1/registries', registries);
  app.route('/v1/orgs', teams);
  app.route('/v1/orgs', sso);
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
