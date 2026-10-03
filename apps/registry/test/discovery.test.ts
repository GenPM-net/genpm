// D4-A-01 / D4-A-02 / D4-A-05: crons, featured, stats, scopes, badges y advisories.
import { env } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import { auditTags, recomputePopularity, rollupInstalls, syncSponsorships } from '../src/cron/index.js';
import { FakeGitHub } from './fake-github.js';
import { call, json, seed } from './helpers.js';

beforeAll(async () => {
  await seed();
  await env.DB.prepare(
    `INSERT INTO advisories (id, public_id, package_id, affected_range, patched_version, severity, title, description, published_at)
     VALUES ('adv_1', 'GENPM-2026-0007', 'pkg_fixture02', '<1.2.1', '1.2.1', 'high', '{"en":"session fixation in session.ts","es":"fijación de sesión en session.ts"}', '{"en":"…"}', 1)`,
  ).run();
});

describe('GET /v1/featured and /v1/stats', () => {
  it('lists featured by rank and trending by installs', async () => {
    const { body } = await json<{ featured: Array<{ name: string }>; trending: Array<{ name: string }> }>(
      '/v1/featured',
    );
    expect(body.featured.map((p) => p.name)).toEqual(['@core/db', '@core/auth', '@core/billing']);
    expect(body.trending[0]!.name).toBe('@core/billing');
    const c = await json<{ f: unknown[] }>('/v1/featured?fmt=c');
    expect(c.body.f).toHaveLength(3);
  });
  it('counts public packages', async () => {
    const { body } = await json('/v1/stats');
    expect(body).toMatchObject({ packages: 3, publishers: 1, withMcp: 1 });
  });
  it('describes a publisher scope', async () => {
    const { body } = await json<{ scope: string; reserved: boolean; packages: unknown[] }>('/v1/scopes/@core');
    expect(body).toMatchObject({ scope: '@core', reserved: true });
    expect(body.packages).toHaveLength(3);
    expect((await call('/v1/scopes/@nope')).status).toBe(404);
  });
});

describe('GET /v1/badge', () => {
  it('renders shields-style SVG with brand colors, cached for an hour', async () => {
    const res = await call('/v1/badge/@core/auth.svg');
    expect(res.headers.get('content-type')).toBe('image/svg+xml; charset=utf-8');
    expect(res.headers.get('cache-control')).toBe('public, max-age=3600, stale-while-revalidate=86400');
    const svg = await res.text();
    expect(svg).toContain('<title>genpm: v1.2.0</title>');
    expect(svg).toContain('fill="#0B0D11"');
    expect(svg).toContain('fill="#549800"');
    expect(await (await call('/v1/badge/@core/billing.svg?type=installs')).text()).toContain('300/mo');
    expect(await (await call('/v1/badge/@core/billing.svg?type=mcp')).text()).toContain('fill="#087584"');
    expect(await (await call('/v1/badge/@core/db.svg?type=verified')).text()).toContain('✓ verified');
    expect(await (await call('/v1/badge/@core/nope.svg')).text()).toContain('not found');
  });
});

describe('GET /v1/advisories', () => {
  it('returns advisories in range, localized, plus yanked versions', async () => {
    await env.DB.prepare(
      "UPDATE package_versions SET yanked_at = 1, yank_reason = 'migration bug' WHERE id = 'ver_fixture0101'",
    ).run();
    const { body } = await json<{ advisories: Array<Record<string, unknown>> }>(
      '/v1/advisories?p=@core/auth@1.2.0,@core/db@1.0.0,@core/db@1.0.3',
      { headers: { 'accept-language': 'es' } },
    );
    expect(body.advisories).toEqual([
      {
        id: 'GENPM-2026-0007',
        n: '@core/auth',
        v: '1.2.0',
        kind: 'advisory',
        severity: 'high',
        title: 'fijación de sesión en session.ts',
        fix: 'Update to 1.2.1 or later',
      },
      {
        id: 'GENPM-YANKED',
        n: '@core/db',
        v: '1.0.0',
        kind: 'yanked',
        severity: 'medium',
        title: 'migration bug',
        fix: 'Install 1.0.3',
      },
    ]);
    expect((await call('/v1/advisories?p=nope')).status).toBe(400);
  });
});

describe('cron triggers', () => {
  it('rolls up installs and recomputes popularity and sponsorships', async () => {
    const day = new Date().toISOString().slice(0, 10);
    await rollupInstalls(env, fetch, [
      { name: '@core/db', client: 'cli', day, n: 40 },
      { name: '@core/db', client: 'mcp', day, n: 10 },
    ]);
    const row = await env.DB.prepare(
      "SELECT installs, via_mcp FROM install_stats_daily WHERE package_id = 'pkg_fixture01'",
    ).first();
    expect(row).toEqual({ installs: 50, via_mcp: 10 });
    const pkg = await env.DB.prepare(
      "SELECT installs_30d, installs_total FROM packages WHERE id = 'pkg_fixture01'",
    ).first();
    expect(pkg).toEqual({ installs_30d: 50, installs_total: 50 });
    await recomputePopularity(env, Date.UTC(2026, 9, 2));
    const score = await env.DB.prepare("SELECT popularity_score FROM packages WHERE id = 'pkg_fixture01'").first<{
      popularity_score: number;
    }>();
    expect(score!.popularity_score).toBeCloseTo(Math.log(51) / 10 + 0.5 + 0.3, 5);
    await env.DB.prepare(
      "INSERT INTO sponsorships (id, registry_id, package_id, sponsor_account_id, placement, starts_at, ends_at, status, created_at) VALUES ('spn_1', 'reg_public', 'pkg_fixture03', 'acc_system', 'search_slot', 1, 2, 'active', 1)",
    ).run();
    await syncSponsorships(env, 10);
    expect(await env.DB.prepare("SELECT status FROM sponsorships WHERE id = 'spn_1'").first()).toEqual({
      status: 'ended',
    });
  });
  it('audits tags: detects moved tags and recreated repos', async () => {
    const shaDb = await env.DB.prepare("SELECT commit_sha FROM package_versions WHERE id = 'ver_fixture0102'").first<{
      commit_sha: string;
    }>();
    await env.DB.prepare("UPDATE packages SET git_repo_id = 1 WHERE id IN ('pkg_fixture01','pkg_fixture02')").run();
    const gh = new FakeGitHub()
      .addRepo('genpm-net/db', { id: 1, tags: { 'v1.0.3': 'f'.repeat(40) }, commits: { ['f'.repeat(40)]: {} } })
      .addRepo('genpm-net/auth', { id: 999, tags: {}, commits: {} });
    const original = globalThis.fetch;
    globalThis.fetch = gh.fetch.bind(gh) as typeof fetch;
    try {
      const r = await auditTags(env);
      expect(r.moved).toEqual(['@core/db']);
      expect(r.unavailable).toEqual(['@core/auth', '@core/billing']);
    } finally {
      globalThis.fetch = original;
    }
    expect(shaDb?.commit_sha).toMatch(/^[0-9a-f]{40}$/);
    const log = await env.DB.prepare(
      "SELECT action FROM audit_log WHERE action IN ('version.tag_moved','package.source_unavailable') ORDER BY action",
    ).all();
    expect(log.results.map((r) => r['action'])).toEqual([
      'package.source_unavailable',
      'package.source_unavailable',
      'version.tag_moved',
    ]);
  });
});

describe('GET /v1/advisories/feed', () => {
  it('lists public advisories localized', async () => {
    const { body } = await json<{ advisories: Array<Record<string, unknown>> }>('/v1/advisories/feed', {
      headers: { 'accept-language': 'es' },
    });
    expect(body.advisories[0]).toMatchObject({
      id: 'GENPM-2026-0007',
      package: '@core/auth',
      severity: 'high',
      title: 'fijación de sesión en session.ts',
    });
  });
});
