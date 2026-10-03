// GET /v1/featured, /v1/stats, /v1/scopes/:scope y /v1/badge/:scope/:name.svg (api-spec §4).

import { Hono } from 'hono';
import { badgeSvg, compactCount } from '../badge.js';
import { CACHE, cached } from '../cache.js';
import type { AppEnv } from '../env.js';
import { httpError } from '../http.js';
import { compactSearchRow, longSearchRow } from '../views.js';
import { repoOf, wantsCompact } from './util.js';

export const featured = new Hono<AppEnv>().get('/', cached({ control: () => CACHE.short }), async (c) => {
  const repo = repoOf(c);
  const [feat, trending] = await Promise.all([repo.featured(12), repo.trending(12)]);
  const locale = c.get('locale');
  const kws = async (rows: typeof feat) => Promise.all(rows.map((r) => repo.keywordsOf(r.id)));
  const [fk, tk] = await Promise.all([kws(feat), kws(trending)]);
  if (wantsCompact(c)) {
    return c.json({
      f: feat.map((r, i) => compactSearchRow(r, fk[i]!, locale)),
      t: trending.map((r, i) => compactSearchRow(r, tk[i]!, locale)),
    });
  }
  return c.json({
    featured: feat.map((r, i) => longSearchRow(r, fk[i]!, locale)),
    trending: trending.map((r, i) => longSearchRow(r, tk[i]!, locale)),
  });
});

export const stats = new Hono<AppEnv>().get('/', cached({ control: () => CACHE.short }), async (c) =>
  c.json(await repoOf(c).stats()),
);

export const scopes = new Hono<AppEnv>().get(
  '/:scope{@?[a-z0-9][a-z0-9-]*}',
  cached({ control: () => CACHE.short }),
  async (c) => {
    const name = c.req.param('scope').replace(/^@/, '');
    const repo = repoOf(c);
    const scope = await repo.scope(name);
    if (!scope) throw httpError('E_NOT_FOUND', { name: `@${name}` });
    const owner = await c.env.DB.prepare(
      'SELECT handle, kind, display_name, avatar_url, is_verified FROM accounts WHERE id = ?1',
    )
      .bind(scope.owner_id)
      .first<{
        handle: string;
        kind: string;
        display_name: string | null;
        avatar_url: string | null;
        is_verified: number;
      }>();
    const pkgs = await repo.packagesOfScope(scope.id);
    const kws = await Promise.all(pkgs.map((p) => repo.keywordsOf(p.id)));
    const locale = c.get('locale');
    return c.json({
      scope: `@${scope.name}`,
      reserved: scope.is_reserved === 1,
      gitOwner: scope.git_owner,
      publisher: owner
        ? {
            handle: owner.handle,
            kind: owner.kind,
            displayName: owner.display_name,
            avatarUrl: owner.avatar_url,
            verified: owner.is_verified === 1,
          }
        : null,
      packages: pkgs.map((p, i) => longSearchRow(p, kws[i]!, locale)),
      totals: { packages: pkgs.length, installs30d: pkgs.reduce((n, p) => n + p.installs_30d, 0) },
    });
  },
);

export const badge = new Hono<AppEnv>().get(
  '/:scope{@[a-z0-9][a-z0-9-]*}/:file{[a-z0-9][a-z0-9-]*\\.svg}',
  cached({ control: () => CACHE.hour }),
  async (c) => {
    const name = `${c.req.param('scope')}/${c.req.param('file').replace(/\.svg$/, '')}`;
    const pkg = await repoOf(c).packageByName(name);
    const type = c.req.query('type') ?? 'version';
    let svg: string;
    if (!pkg) svg = badgeSvg('genpm', 'not found', 'installs');
    else if (type === 'installs') svg = badgeSvg('installs', `${compactCount(pkg.installs_30d)}/mo`, 'installs');
    else if (type === 'mcp') svg = badgeSvg('genpm', pkg.has_mcp ? 'mcp' : 'no mcp', 'mcp');
    else if (type === 'verified') {
      const owner = await c.env.DB.prepare('SELECT is_verified FROM accounts WHERE id = ?1')
        .bind(pkg.owner_id)
        .first<{ is_verified: number }>();
      svg = badgeSvg('genpm', owner?.is_verified ? '✓ verified' : 'unverified', 'verified');
    } else svg = badgeSvg('genpm', pkg.latest_version ? `v${pkg.latest_version}` : 'unpublished', 'version');
    return c.body(svg, 200, {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
    });
  },
);

/**
 * GET /v1/advisories?p=@core/auth@1.2.0,@core/db@1.0.3 (api-spec §4, security §3.4): advisories que afectan a cada
 * versión, versiones retiradas y cuarentenas. Lo consume `genpm audit`.
 */
export const advisories = new Hono<AppEnv>()
  .get('/feed', cached({ control: () => CACHE.short }), async (c) => {
    // Feed público de advisories (web /security/advisories y su JSON).
    const { results } = await c.env.DB.prepare(
      `SELECT a.public_id, p.full_name, a.affected_range, a.patched_version, a.severity, a.cve, a.title, a.published_at
       FROM advisories a JOIN packages p ON p.id = a.package_id
       WHERE p.registry_id = ?1 AND p.visibility = 'public' AND a.withdrawn_at IS NULL ORDER BY a.published_at DESC LIMIT 200`,
    )
      .bind(c.get('tenant').registryId)
      .all<{
        public_id: string;
        full_name: string;
        affected_range: string;
        patched_version: string | null;
        severity: string;
        cve: string | null;
        title: string;
        published_at: number;
      }>();
    const locale = c.get('locale');
    const text = (json: string) => {
      try {
        const m = JSON.parse(json) as Record<string, string>;
        return m[locale] ?? m['en'] ?? '';
      } catch {
        return json;
      }
    };
    return c.json({
      advisories: results.map((a) => ({
        id: a.public_id,
        package: a.full_name,
        affected: a.affected_range,
        patched: a.patched_version,
        severity: a.severity,
        cve: a.cve,
        title: text(a.title),
        publishedAt: new Date(a.published_at).toISOString(),
      })),
    });
  })
  .get('/', cached({ control: () => CACHE.short }), async (c) => {
    const raw = (c.req.query('p') ?? '').split(',').slice(0, 100);
    const wanted: Array<{ n: string; v: string }> = [];
    for (const item of raw) {
      const m = item.trim().match(/^(@[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*)@([0-9A-Za-z.+-]{1,64})$/);
      if (m) wanted.push({ n: m[1]!, v: m[2]! });
    }
    if (!wanted.length) throw httpError('E_BAD_REQUEST', { detail: 'p' });
    const repo = repoOf(c);
    const pkgs = new Map((await repo.packagesByNames(wanted.map((w) => w.n))).map((p) => [p.full_name, p]));
    const advs = await repo.advisoriesFor([...pkgs.values()].map((p) => p.id));
    const { satisfies } = await import('@genpm/manifest');
    const locale = c.get('locale');
    const pickText = (json: string) => {
      try {
        const m = JSON.parse(json) as Record<string, string>;
        return m[locale] ?? m[locale.split('-')[0]!] ?? m['en'] ?? '';
      } catch {
        return json;
      }
    };
    const out: Array<{
      id: string;
      n: string;
      v: string;
      kind: 'advisory' | 'yanked' | 'quarantined';
      severity: string;
      title: string;
      fix: string | null;
    }> = [];
    for (const w of wanted) {
      const pkg = pkgs.get(w.n);
      if (!pkg) continue;
      for (const a of advs.filter((x) => x.package_id === pkg.id)) {
        if (satisfies(w.v, a.affected_range)) {
          out.push({
            id: a.public_id,
            n: w.n,
            v: w.v,
            kind: 'advisory',
            severity: a.severity,
            title: pickText(a.title),
            fix: a.patched_version ? `Update to ${a.patched_version} or later` : null,
          });
        }
      }
      const v = await repo.version(pkg.id, w.v);
      if (v?.yanked_at)
        out.push({
          id: 'GENPM-YANKED',
          n: w.n,
          v: w.v,
          kind: 'yanked',
          severity: 'medium',
          title: v.yank_reason ?? 'yanked',
          fix: pkg.latest_version ? `Install ${pkg.latest_version}` : null,
        });
      if (pkg.status === 'quarantined' || v?.status === 'quarantined') {
        out.push({
          id: 'GENPM-QUARANTINE',
          n: w.n,
          v: w.v,
          kind: 'quarantined',
          severity: 'high',
          title: 'under security review',
          fix: null,
        });
      }
    }
    return c.json({ advisories: out });
  });
