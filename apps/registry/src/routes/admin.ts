// GET /v1/admin/analytics (solo staff): datos del panel /admin/analytics de la web (ADR-027). Lee Analytics Engine
// (visitas e instalaciones, sin identificadores) y D1 (publicaciones, logins y cuentas nuevas). Nunca se cachea.
import { Hono } from 'hono';
import type { AppEnv } from '../env.js';
import { httpError } from '../http.js';
import { requireAuth } from '../middleware/auth.js';
import { aeConfigured, aeDataset, aeQuery } from '../services/ae.js';

const DAY = 86_400_000;

type KV = { k: string; n: number };

export const admin = new Hono<AppEnv>().get('/analytics', requireAuth(), async (c) => {
  // A quien no es staff se le responde como si la ruta no existiera.
  if (!c.get('actor')!.isStaff) throw httpError('E_NOT_FOUND', { name: '/v1/admin/analytics' });
  const days = Math.min(90, Math.max(1, Number.parseInt(c.req.query('days') ?? '7', 10) || 7));
  const sinceMs = Date.now() - (days - 1) * DAY;
  const since = new Date(sinceMs).toISOString().slice(0, 10);
  const startMs = Date.parse(`${since}T00:00:00Z`);
  const env = c.env;
  const db = env.DB;
  const registryId = c.get('tenant').registryId;

  const d1 = db
    .prepare(
      `SELECT strftime('%Y-%m-%d', created_at / 1000, 'unixepoch') AS day, action, count(*) AS n FROM audit_log
       WHERE registry_id = ?1 AND created_at >= ?2 AND action IN ('package.publish', 'auth.login') GROUP BY day, action
       UNION ALL
       SELECT strftime('%Y-%m-%d', created_at / 1000, 'unixepoch') AS day, 'account.create' AS action, count(*) AS n
       FROM accounts WHERE created_at >= ?2 AND kind = 'user' GROUP BY day ORDER BY day`,
    )
    .bind(registryId, startMs)
    .all<{ day: string; action: string; n: number }>();

  if (!aeConfigured(env)) {
    return c.json({ days, since, configured: false, web: null, installs: null, registry: (await d1).results });
  }
  const W = aeDataset(env, 'web');
  const I = aeDataset(env, 'installs');
  const ts = `timestamp >= toDateTime('${since} 00:00:00')`;
  const day = `formatDateTime(timestamp, '%Y-%m-%d')`;
  const n = 'SUM(_sample_interval)';
  const top = (ds: string, col: string, where: string, limit = 20) =>
    aeQuery<KV>(
      env,
      `SELECT ${col} AS k, ${n} AS n FROM ${ds} WHERE ${ts} AND ${where} GROUP BY k ORDER BY n DESC LIMIT ${limit} FORMAT JSON`,
    );
  // Personas sin sesión: las visitas con sesión (fundador, staff, autores) se cuentan aparte como `member`.
  const people = "blob5 = 'human'";
  const [
    webDaily,
    referrers,
    pages,
    countries,
    campaigns,
    packages,
    searches,
    instDaily,
    instPackages,
    instCountries,
    versions,
    registry,
  ] = await Promise.all([
    aeQuery<{ day: string; event: string; who: string; n: number }>(
      env,
      `SELECT ${day} AS day, blob1 AS event, blob5 AS who, ${n} AS n FROM ${W} WHERE ${ts} GROUP BY day, event, who ORDER BY day FORMAT JSON`,
    ),
    top(W, 'blob6', `blob1 = 'page_view' AND ${people} AND blob6 != ''`),
    top(W, 'blob2', `blob1 = 'page_view' AND ${people}`),
    top(W, 'blob7', `blob1 = 'page_view' AND ${people} AND blob7 != ''`),
    top(W, 'blob8', `blob1 = 'page_view' AND blob8 != ''`),
    top(W, 'blob2', `blob1 = 'pkg_view' AND ${people}`),
    aeQuery<KV & { results: number }>(
      env,
      `SELECT blob2 AS k, ${n} AS n, MAX(double1) AS results FROM ${W} WHERE ${ts} AND blob1 = 'search' AND blob5 != 'bot' GROUP BY k ORDER BY n DESC LIMIT 30 FORMAT JSON`,
    ),
    aeQuery<{ day: string; client: string; n: number }>(
      env,
      `SELECT ${day} AS day, blob3 AS client, ${n} AS n FROM ${I} WHERE ${ts} AND blob3 IN ('cli', 'mcp') GROUP BY day, client ORDER BY day FORMAT JSON`,
    ),
    top(I, 'blob1', "blob3 IN ('cli', 'mcp')"),
    top(I, 'blob5', "blob3 IN ('cli', 'mcp') AND blob5 != ''"),
    top(I, 'blob4', "blob3 = 'cli' AND blob4 != ''", 10),
    d1,
  ]);
  const num = <T extends { n: number | string }>(rows: T[]) => rows.map((r) => ({ ...r, n: Number(r.n) }));
  return c.json({
    days,
    since,
    configured: true,
    web: {
      daily: num(webDaily),
      referrers: num(referrers),
      pages: num(pages),
      countries: num(countries),
      campaigns: num(campaigns),
      packages: num(packages),
      searches: num(searches).map((s) => ({ ...s, results: Number(s.results) })),
    },
    installs: {
      daily: num(instDaily),
      packages: num(instPackages),
      countries: num(instCountries),
      cliVersions: num(versions),
    },
    registry: registry.results,
  });
});
