// GET /v1/packages/:scope/:name, /versions y /versions/:version (api-spec §4.3–4.4).

import { signatureHeader } from '@genpm/manifest';
import { Hono } from 'hono';
import { CACHE, cached } from '../cache.js';
import type { AppEnv } from '../env.js';
import { httpError } from '../http.js';
import { qualityChecks } from '../services/quality.js';
import { compactManifest, iso, longManifest, summaryOf } from '../views.js';
import { decodeCursor, encodeCursor, fullName, repoOf, wantsCompact } from './util.js';

const PKG = '/:scope{@[a-z0-9][a-z0-9-]*}/:name{[a-z0-9][a-z0-9-]*}';

export const packages = new Hono<AppEnv>()
  .get(PKG, cached({ control: () => CACHE.short }), async (c) => {
    const repo = repoOf(c);
    const name = fullName(c);
    const pkg = await repo.packageByName(name);
    if (!pkg) throw httpError('E_NOT_FOUND', { name });
    const [publisher, keywords, distTags] = await Promise.all([
      repo.publisherOf(pkg),
      repo.keywordsOf(pkg.id),
      repo.distTags(pkg.id),
    ]);
    const latest = pkg.latest_version_id ? await repo.versionById(pkg.latest_version_id) : null;
    const locale = c.get('locale');
    if (wantsCompact(c)) {
      return c.json({
        n: pkg.full_name,
        s: summaryOf(pkg.summary, locale) ?? '',
        dt: distTags,
        latest: latest ? compactManifest(latest, locale) : null,
        i: pkg.installs_30d,
        vf: publisher?.is_verified ?? 0,
        st: pkg.status,
        dep: pkg.is_deprecated ? (pkg.deprecation_msg ?? '') : null,
        scan: latest?.scan_status ?? null,
        q: pkg.quality_score,
      });
    }
    const weekly = await c.env.DB.prepare(
      `SELECT sum(installs) AS n FROM install_stats_daily WHERE package_id = ?1 AND day >= date('now', '-84 days')
       GROUP BY strftime('%W', day) ORDER BY min(day)`,
    )
      .bind(pkg.id)
      .all<{ n: number }>();
    return c.json({
      id: pkg.id,
      name: pkg.full_name,
      summary: summaryOf(pkg.summary, locale) ?? null,
      visibility: pkg.visibility,
      status: pkg.status,
      repo: pkg.repo_url,
      homepage: pkg.homepage,
      license: pkg.license,
      keywords,
      category: pkg.category,
      publisher: publisher
        ? {
            handle: publisher.handle,
            kind: publisher.kind,
            verified: publisher.is_verified === 1,
            avatarUrl: publisher.avatar_url,
          }
        : null,
      distTags,
      latest: latest ? longManifest(latest, locale) : null,
      flags: {
        featured: pkg.is_featured === 1,
        sponsored: pkg.is_sponsored === 1,
        deprecated: pkg.is_deprecated === 1,
        deprecationMessage: pkg.deprecation_msg,
      },
      quality: { score: pkg.quality_score, checks: qualityChecks(pkg.quality) },
      dependentsCount: await repo.dependentsCount(pkg.full_name),
      stats: {
        installs30d: pkg.installs_30d,
        installsTotal: pkg.installs_total,
        weekly: weekly.results.map((w) => w.n),
      },
      security: {
        scanStatus: latest?.scan_status ?? null,
        scannedAt: iso(latest?.published_at),
        findings: latest?.scan_report
          ? ((JSON.parse(latest.scan_report) as { findings?: unknown[] }).findings ?? [])
          : [],
      },
      contextPreview: latest?.context_excerpt ?? null,
      createdAt: iso(pkg.created_at),
      updatedAt: iso(pkg.updated_at),
    });
  })
  .get(`${PKG}/dependents`, cached({ control: () => CACHE.short }), async (c) => {
    const repo = repoOf(c);
    const name = fullName(c);
    if (!(await repo.packageByName(name))) throw httpError('E_NOT_FOUND', { name });
    const limit = Math.min(Math.max(Number(c.req.query('limit') ?? 20) || 20, 1), 50);
    const offset = decodeCursor(c.req.query('cursor'));
    const [rows, total] = await Promise.all([repo.dependents(name, limit + 1, offset), repo.dependentsCount(name)]);
    const next = rows.length > limit ? encodeCursor(offset + limit) : null;
    const locale = c.get('locale');
    const items = rows.slice(0, limit).map((p) => ({
      n: p.full_name,
      v: p.latest_version!,
      s: summaryOf(p.summary, locale) ?? '',
      range: p.dep_range,
      i: p.installs_30d,
      vf: p.is_verified,
    }));
    return c.json(
      wantsCompact(c)
        ? { r: items, nx: next }
        : {
            dependents: items.map((x) => ({
              name: x.n,
              version: x.v,
              summary: x.s || null,
              range: x.range,
              installs30d: x.i,
              verified: x.vf === 1,
            })),
            next,
            total,
          },
    );
  })
  .get(`${PKG}/versions`, cached({ control: () => CACHE.short }), async (c) => {
    const repo = repoOf(c);
    const name = fullName(c);
    const pkg = await repo.packageByName(name);
    if (!pkg) throw httpError('E_NOT_FOUND', { name });
    const limit = Math.min(Math.max(Number(c.req.query('limit') ?? 20) || 20, 1), 50);
    const offset = decodeCursor(c.req.query('cursor'));
    const all = await repo.versions(pkg.id);
    const page = all.slice(offset, offset + limit);
    const next = offset + limit < all.length ? encodeCursor(offset + limit) : null;
    const items = page.map((v) => ({
      v: v.version,
      t: v.git_ref,
      c: v.commit_sha,
      publishedAt: iso(v.published_at),
      yanked: v.yanked_at !== null,
      yankReason: v.yank_reason,
      scanStatus: v.scan_status,
    }));
    return c.json(wantsCompact(c) ? { r: items, nx: next } : { versions: items, next, total: all.length });
  })
  .get(
    `${PKG}/versions/:version{[0-9A-Za-z.+-]+}`,
    cached({ control: (res) => (res.headers.get('genpm-yanked') ? CACHE.short : CACHE.immutable) }),
    async (c) => {
      const repo = repoOf(c);
      const name = fullName(c);
      const pkg = await repo.packageByName(name);
      if (!pkg) throw httpError('E_NOT_FOUND', { name });
      const v = await repo.version(pkg.id, c.req.param('version'));
      if (!v) throw httpError('E_NO_MATCHING_VERSION', { name, range: c.req.param('version') });
      if (v.status === 'quarantined' || v.scan_status === 'flagged')
        throw httpError('E_QUARANTINED', { name: `${name}@${v.version}` });
      if (v.signature) c.header('genpm-signature', signatureHeader(v.signature));
      if (v.yanked_at) c.header('genpm-yanked', '1');
      const publisher = await c.env.DB.prepare('SELECT handle FROM accounts WHERE id = ?1')
        .bind(v.published_by)
        .first<{ handle: string }>();
      const extra = {
        yanked: v.yanked_at !== null,
        yankReason: v.yank_reason,
        publishedBy: publisher?.handle ?? null,
        publishedAt: iso(v.published_at),
      };
      const locale = c.get('locale');
      return c.json(
        wantsCompact(c)
          ? { ...compactManifest(v, locale), ...extra }
          : { ...longManifest(v, locale), ...extra, scanStatus: v.scan_status },
      );
    },
  );
