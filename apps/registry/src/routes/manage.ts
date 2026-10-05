// Gestión desde la web (V02-07 / V02-08): deprecar un paquete, preferencias de la cuenta, comparar versiones
// (diff visual) y estado del servicio. Toda escritura deja rastro en audit_log.

import { Hono } from 'hono';
import { z } from 'zod';
import { CACHE, cached, purgePackage } from '../cache.js';
import type { AppEnv } from '../env.js';
import { httpError } from '../http.js';
import { newId } from '../ids.js';
import { requireAuth } from '../middleware/auth.js';
import { GitHub, parseGithubRepo } from '../services/github.js';
import { VERSION } from './health.js';
import { fullName, repoOf } from './util.js';
import { canWrite } from './yank.js';

const PKG = '/:scope{@[a-z0-9][a-z0-9-]*}/:name{[a-z0-9][a-z0-9-]*}';
const Deprecate = z.strictObject({ message: z.string().trim().min(3).max(280).nullable() });

/** POST /v1/packages/:scope/:name/deprecate — `{ message }` deprecia; `{ message: null }` lo revierte. */
export const deprecate = new Hono<AppEnv>().post(`${PKG}/deprecate`, requireAuth('publish'), async (c) => {
  const actor = c.get('actor')!;
  const parsed = Deprecate.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw httpError('E_BAD_REQUEST', { detail: 'message' });
  const name = fullName(c);
  const pkg = await repoOf(c).packageByName(name);
  if (!pkg || !(await canWrite(c, actor, pkg.owner_id))) throw httpError('E_NOT_FOUND', { name });
  const now = Date.now();
  const message = parsed.data.message;
  await c.env.DB.batch([
    c.env.DB.prepare(
      'UPDATE packages SET is_deprecated = ?1, deprecation_msg = ?2, updated_at = ?3 WHERE id = ?4',
    ).bind(message ? 1 : 0, message, now, pkg.id),
    c.env.DB.prepare(
      "INSERT INTO audit_log (id, registry_id, actor_id, action, target_type, target_id, metadata, created_at) VALUES (?1, ?2, ?3, ?4, 'package', ?5, ?6, ?7)",
    ).bind(
      newId('aud'),
      c.get('tenant').registryId,
      actor.accountId,
      message ? 'package.deprecate' : 'package.undeprecate',
      pkg.id,
      JSON.stringify({ message }),
      now,
    ),
  ]);
  c.executionCtx.waitUntil(purgePackage(c, name));
  return c.json({ ok: true, deprecated: !!message });
});

const LOCALES = ['en', 'es', 'pt-BR', 'fr', 'de', 'ja', 'zh-CN', 'ko'] as const;
const Prefs = z.strictObject({ locale: z.enum(LOCALES).nullable() });

/** PATCH /v1/me — preferencias de la cuenta (hoy: idioma de los correos y avisos). */
export const mePrefs = new Hono<AppEnv>().patch('/', requireAuth(), async (c) => {
  const parsed = Prefs.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw httpError('E_BAD_REQUEST', { detail: 'locale' });
  const actor = c.get('actor')!;
  await c.env.DB.prepare('UPDATE accounts SET locale = ?1, updated_at = ?2 WHERE id = ?3')
    .bind(parsed.data.locale, Date.now(), actor.accountId)
    .run();
  return c.json({ ok: true, locale: parsed.data.locale });
});

type GhCompare = {
  files?: Array<{
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    patch?: string;
    previous_filename?: string;
  }>;
};

/**
 * GET /v1/packages/:scope/:name/compare?from=1.0.0&to=1.1.0 — diff entre dos versiones publicadas, limitado a `i` y
 * remapeado a rutas relativas al paquete. Dos SHAs no cambian nunca: respuesta inmutable en caché.
 */
export const compare = new Hono<AppEnv>().get(
  `${PKG}/compare`,
  cached({ control: (res) => (res.status === 200 ? CACHE.immutable : CACHE.short) }),
  async (c) => {
    const repo = repoOf(c);
    const name = fullName(c);
    const pkg = await repo.packageByName(name);
    if (!pkg) throw httpError('E_NOT_FOUND', { name });
    const [from, to] = await Promise.all([
      repo.version(pkg.id, c.req.query('from') ?? ''),
      repo.version(pkg.id, c.req.query('to') ?? pkg.latest_version ?? ''),
    ]);
    if (!from || !to)
      throw httpError('E_NO_MATCHING_VERSION', { name, range: `${c.req.query('from')}..${c.req.query('to')}` });
    if (from.status === 'quarantined' || to.status === 'quarantined') throw httpError('E_QUARANTINED', { name });
    const gh = parseGithubRepo(pkg.repo_url);
    if (!gh) throw httpError('E_NOT_FOUND', { name });
    const data = await new GitHub(c.env).json<GhCompare>(
      `/repos/${gh.owner}/${gh.repo}/compare/${from.commit_sha}...${to.commit_sha}`,
    );
    if (!data) throw httpError('E_UPSTREAM_GIT', { detail: 'compare unavailable' });
    const prefix = to.include_path === '.' ? '' : `${to.include_path}/`;
    const files = (data.files ?? [])
      .filter((f) => f.filename.startsWith(prefix))
      .slice(0, 300)
      .map((f) => ({
        path: f.filename.slice(prefix.length),
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        // GitHub omite el parche en archivos grandes o binarios.
        patch: f.patch && f.patch.length <= 60_000 ? f.patch : null,
      }));
    return c.json({
      name,
      from: { version: from.version, commit: from.commit_sha },
      to: { version: to.version, commit: to.commit_sha },
      dest: to.dest,
      files,
    });
  },
);

/** GET /v1/status — estado para la página /status: base de datos, modo solo lectura y últimas ejecuciones del cron. */
export const status = new Hono<AppEnv>().get('/', async (c) => {
  const started = Date.now();
  let db = true;
  let crons: Record<string, { at: number; ok: boolean }> = {};
  try {
    const { results } = await c.env.DB.prepare("SELECT key, value FROM registry_meta WHERE key LIKE 'cron:%'").all<{
      key: string;
      value: string;
    }>();
    crons = Object.fromEntries(
      results.map((r) => [r.key.slice(5), JSON.parse(r.value) as { at: number; ok: boolean }]),
    );
  } catch {
    db = false;
  }
  c.header('Cache-Control', 'public, max-age=30');
  return c.json({
    ok: db && c.env.READ_ONLY !== '1',
    version: VERSION,
    env: c.env.ENVIRONMENT,
    components: {
      api: 'operational',
      database: db ? 'operational' : 'outage',
      publishing: c.env.READ_ONLY === '1' ? 'degraded' : 'operational',
    },
    dbMs: Date.now() - started,
    crons: Object.fromEntries(
      Object.entries(crons).map(([k, v]) => [k, { at: new Date(v.at).toISOString(), ok: v.ok }]),
    ),
  });
});
