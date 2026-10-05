// V02-03 / V02-04: "Used by" (dependents) y puntuación de calidad.
import { env } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import { recomputeQuality } from '../src/services/quality.js';
import { json, seed } from './helpers.js';

beforeAll(async () => {
  await seed();
});

describe('GET /v1/packages/:scope/:name/dependents', () => {
  it('lists packages whose latest version depends on it', async () => {
    const { status, body } = await json<{ dependents: Array<{ name: string; range: string }>; total: number }>(
      '/v1/packages/@core/db/dependents',
    );
    expect(status).toBe(200);
    expect(body.total).toBeGreaterThan(0);
    expect(body.dependents.map((d) => d.name)).toContain('@core/auth');
    expect(body.dependents.find((d) => d.name === '@core/auth')!.range).toMatch(/\^1/);
    const c = await json<{ r: Array<{ n: string }> }>('/v1/packages/@core/db/dependents?fmt=c');
    expect(c.body.r.length).toBe(body.dependents.length);
    expect((await json('/v1/packages/@core/nope/dependents')).status).toBe(404);
  });
});

describe('quality score', () => {
  it('is recomputed and exposed with its checks', async () => {
    expect(await recomputeQuality(env)).toBeGreaterThan(0);
    const { body } = await json<{
      quality: { score: number; checks: Array<{ id: string; ok: boolean }> };
      dependentsCount: number;
    }>('/v1/packages/@core/db');
    expect(body.quality.score).toBeGreaterThan(0);
    expect(body.quality.score).toBeLessThanOrEqual(100);
    expect(body.quality.checks.find((c) => c.id === 'license')!.ok).toBe(true);
    expect(body.dependentsCount).toBeGreaterThan(0);
    const s = await json<{ results: Array<{ name: string; quality: number }> }>('/v1/search?q=drizzle');
    expect(s.body.results[0]!.quality).toBe(body.quality.score);
  });
  it('a deprecated package scores 0', async () => {
    await env.DB.prepare("UPDATE packages SET is_deprecated = 1 WHERE id = 'pkg_fixture03'").run();
    await recomputeQuality(env, 'pkg_fixture03');
    const row = await env.DB.prepare("SELECT quality_score FROM packages WHERE id = 'pkg_fixture03'").first();
    expect(row).toEqual({ quality_score: 0 });
    await env.DB.prepare("UPDATE packages SET is_deprecated = 0 WHERE id = 'pkg_fixture03'").run();
  });
});
