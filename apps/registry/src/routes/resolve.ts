// GET /v1/resolve/:scope/:name (api-spec §4.2): camino crítico de la instalación. Cuenta como evento de instalación.

import { signatureHeader } from '@genpm/manifest';
import { Hono } from 'hono';
import { CACHE, cached } from '../cache.js';
import type { AppEnv } from '../env.js';
import { httpError } from '../http.js';
import { parseInstalled, pickVersion, resolveClosure, type Warning } from '../services/resolve.js';
import { recordInstall } from '../services/telemetry.js';
import { compactManifest, longManifest } from '../views.js';
import { fullName, repoOf, wantsCompact } from './util.js';

export const resolve = new Hono<AppEnv>().get(
  '/:scope{@[a-z0-9][a-z0-9-]*}/:name{[a-z0-9][a-z0-9-]*}',
  // Telemetría implícita (architecture §6.1): se registra también en aciertos de caché.
  async (c, next) => {
    await next();
    if (c.res.status === 200 || c.res.status === 304) {
      const client = c.req.query('client') ?? 'cli';
      const version = c.res.headers.get('genpm-version');
      if (version) c.executionCtx.waitUntil(recordInstall(c, fullName(c), version, client));
    }
  },
  cached({ control: () => CACHE.short }),
  async (c) => {
    const name = fullName(c);
    const range = (c.req.query('range') ?? 'latest').trim();
    if (range.length > 64) throw httpError('E_BAD_REQUEST', { detail: 'range' });
    const repo = repoOf(c);
    const pkg = await repo.packageByName(name);
    if (!pkg) throw httpError('E_NOT_FOUND', { name });
    const root = await pickVersion(repo, pkg, range);
    const warnings: Warning[] = [];
    if (root.yanked) warnings.push({ code: 'W_YANKED', n: name, msg: root.version.yank_reason ?? 'yanked' });
    if (pkg.is_deprecated) warnings.push({ code: 'W_DEPRECATED', n: name, msg: pkg.deprecation_msg ?? 'deprecated' });
    const closure =
      c.req.query('deps') === '1'
        ? await resolveClosure(repo, root, parseInstalled(c.req.query('installed')))
        : { deps: [], warnings: [] };
    warnings.push(...closure.warnings);
    const locale = c.get('locale');
    const scan = Object.fromEntries([root, ...closure.deps].map((r) => [r.pkg.full_name, r.version.scan_status]));
    if (root.version.signature) c.header('genpm-signature', signatureHeader(root.version.signature));
    c.header('genpm-version', root.version.version);
    if (wantsCompact(c)) {
      return c.json({
        root: compactManifest(root.version, locale),
        deps: closure.deps.map((d) => compactManifest(d.version, locale)),
        w: warnings,
        scan,
      });
    }
    return c.json({
      root: longManifest(root.version, locale),
      deps: closure.deps.map((d) => longManifest(d.version, locale)),
      warnings,
      scan,
    });
  },
);
