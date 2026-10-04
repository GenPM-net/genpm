import { verifyManifest } from '@genpm/manifest';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEV_KEY, get, json, seed } from './helpers.js';

beforeEach(async () => {
  await seed();
});

type Manifest = Record<string, unknown> & { n: string; v: string; c: string; sg?: string };

describe('GET /v1/search (api-spec §4.1)', () => {
  it('finds packages with FTS prefix matching and the compact format', async () => {
    const { status, body } = await json<{ r: Array<Record<string, unknown>>; nx: string | null }>(
      '/v1/search?q=auth&fmt=c',
    );
    expect(status).toBe(200);
    expect(body.r[0]).toMatchObject({
      n: '@core/auth',
      v: '1.2.0',
      s: 'Sessions + OAuth (GitHub, Google) with Drizzle',
      m: 0,
      vf: 1,
    });
    expect(body.r[0]!['k']).toEqual(['auth', 'github', 'oauth', 'sessions']);
    expect(body.nx).toBeNull();
  });
  it('localizes summaries and matches accents and synonyms', async () => {
    const { body } = await json<{ results: Array<{ name: string; summary: string }> }>('/v1/search?q=suscripciones', {
      headers: { 'accept-language': 'es' },
    });
    expect(body.results.map((r) => r.name)).toEqual(['@core/billing']);
    expect(body.results[0]!.summary).toBe('Suscripciones Stripe: checkout, portal y webhooks idempotentes con Drizzle');
    const syn = await json<{ results: Array<{ name: string }> }>('/v1/search?q=autenticación');
    expect(syn.body.results.map((r) => r.name)).toContain('@core/auth');
    // Un sinónimo (grupo OR) seguido de otro término: antes era un error de sintaxis FTS5 (500).
    const multi = await get('/v1/search?q=login+drizzle');
    expect(multi.status).toBe(200);
    expect(((await multi.json()) as { results: Array<{ name: string }> }).results.map((r) => r.name)).toContain(
      '@core/auth',
    );
  });
  it('filters by keyword, mcp and scope and paginates with an opaque cursor', async () => {
    expect((await json<{ results: unknown[] }>('/v1/search?mcp=1')).body.results).toHaveLength(1);
    expect((await json<{ results: unknown[] }>('/v1/search?k=drizzle')).body.results).toHaveLength(1);
    expect((await json<{ results: unknown[] }>('/v1/search?scope=acme')).body.results).toHaveLength(0);
    const p1 = await json<{ results: Array<{ name: string }>; next: string; total: number }>('/v1/search?limit=2');
    expect(p1.body.total).toBe(3);
    expect(p1.body.results).toHaveLength(2);
    const p2 = await json<{ results: Array<{ name: string }>; next: string | null }>(
      `/v1/search?limit=2&cursor=${p1.body.next}`,
    );
    expect(p2.body.results).toHaveLength(1);
    expect(p2.body.next).toBeNull();
  });
  it('escapes FTS operators and never fails on hostile input', async () => {
    for (const q of ['auth OR NEAR(x)', '"', 'a:b*', ')(', 'NOT', '-', "'; DROP TABLE packages; --"]) {
      const { status } = await json(`/v1/search?q=${encodeURIComponent(q)}`);
      expect(status, q).toBe(200);
    }
    expect((await json('/v1/search?limit=500')).status).toBe(400);
  });
  it('searches CJK with the trigram table', async () => {
    const { status } = await json('/v1/search?q=認証モジュール');
    expect(status).toBe(200);
  });
  it('never returns sponsored results in the compact format', async () => {
    const { body } = await json<Record<string, unknown>>('/v1/search?q=auth&sponsored=1&fmt=c');
    expect(body).not.toHaveProperty('sponsored');
  });
  it('caches with ETag and answers 304', async () => {
    const first = await get('/v1/search?q=Auth');
    const etag = first.headers.get('etag');
    expect(etag).toBeTruthy();
    expect(first.headers.get('cache-control')).toBe('public, max-age=30, stale-while-revalidate=300');
    const again = await get('/v1/search?q=auth', { headers: { 'if-none-match': etag! } });
    expect(again.status).toBe(304);
  });
});

describe('GET /v1/resolve (api-spec §4.2)', () => {
  it('resolves latest with signed compact manifest and flat dependency closure', async () => {
    const { status, body, res } = await json<{
      root: Manifest;
      deps: Manifest[];
      w: unknown[];
      scan: Record<string, string>;
    }>('/v1/resolve/@core/billing?deps=1&fmt=c');
    expect(status).toBe(200);
    expect(body.root).toMatchObject({ n: '@core/billing', v: '1.2.0', c: expect.stringMatching(/^[0-9a-f]{40}$/) });
    expect(body.deps.map((d) => `${d.n}@${d.v}`)).toEqual(['@core/auth@1.2.0', '@core/db@1.0.3']);
    expect(body.scan).toEqual({ '@core/billing': 'passed', '@core/auth': 'passed', '@core/db': 'passed' });
    expect(res.headers.get('genpm-signature')).toMatch(/^keyid=dev1,sig=/);
    for (const m of [body.root, ...body.deps]) {
      expect(await verifyManifest(m, m.sg!, { [DEV_KEY.id]: DEV_KEY.public })).toEqual({ ok: true, keyId: 'dev1' });
    }
  });
  it('honours ranges, exact versions and installed packages', async () => {
    expect((await json<{ root: Manifest }>('/v1/resolve/@core/db?range=1.0.0&fmt=c')).body.root.v).toBe('1.0.0');
    expect((await json<{ root: Manifest }>('/v1/resolve/@core/db?range=%5E1&fmt=c')).body.root.v).toBe('1.0.3');
    const r = await json<{ deps: Manifest[] }>('/v1/resolve/@core/auth?deps=1&installed=@core/db@1.0.0&fmt=c');
    expect(r.body.deps.map((d) => d.v)).toEqual(['1.0.0']);
  });
  it('returns 404 for unknown packages and versions', async () => {
    expect((await json<{ code: string }>('/v1/resolve/@core/nope')).body.code).toBe('E_NOT_FOUND');
    expect((await json<{ code: string }>('/v1/resolve/@core/db?range=%5E9')).body.code).toBe('E_NO_MATCHING_VERSION');
  });
  it('reports dependency conflicts with 409 and the conflict tree', async () => {
    await seed(
      [
        {
          $: 1,
          n: '@core/x',
          v: '1.0.0',
          r: 'https://github.com/genpm-net/x',
          t: 'v1.0.0',
          c: 'a'.repeat(40),
          d: 'src/x',
          i: '.',
          x: 'AGENTS.md',
          l: 'MIT',
          s: { en: 'x' },
          g: { '@core/db': '^2.0.0' },
        },
      ],
      10,
    );
    const { status, body } = await json<{ code: string; conflicts: unknown[] }>('/v1/resolve/@core/x?deps=1');
    expect(status).toBe(409);
    expect(body.code).toBe('E_RANGE_UNSATISFIED');
    expect(body.conflicts).toEqual([{ n: '@core/db', ranges: [{ from: '@core/x', range: '^2.0.0' }] }]);
  });
});

describe('GET /v1/packages (api-spec §4.3–4.4)', () => {
  it('returns the long form with publisher, dist-tags and security', async () => {
    const { status, body } = await json<Record<string, unknown>>('/v1/packages/@core/auth');
    expect(status).toBe(200);
    expect(body).toMatchObject({
      name: '@core/auth',
      distTags: { latest: '1.2.0' },
      publisher: { handle: 'genpm-system', verified: true },
      security: { scanStatus: 'passed' },
      flags: { featured: true },
    });
    expect((body['latest'] as Record<string, unknown>)['genpmDependencies']).toEqual({ '@core/db': '^1.0.0' });
  });
  it('lists versions by semver descending and serves exact versions as immutable', async () => {
    const list = await json<{ versions: Array<{ v: string }> }>('/v1/packages/@core/db/versions');
    expect(list.body.versions.map((v) => v.v)).toEqual(['1.0.3', '1.0.0']);
    const exact = await get('/v1/packages/@core/db/versions/1.0.0?fmt=c');
    expect(exact.status).toBe(200);
    expect(exact.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(((await exact.json()) as Manifest).v).toBe('1.0.0');
    expect((await get('/v1/packages/@core/db/versions/9.9.9')).status).toBe(404);
  });
  it('serves public keys', async () => {
    const { body } = await json<{ keys: Array<{ keyid: string; publicKey: string }> }>('/v1/keys');
    expect(body.keys).toEqual([
      expect.objectContaining({ keyid: 'dev1', publicKey: DEV_KEY.public, status: 'active' }),
    ]);
  });
});
