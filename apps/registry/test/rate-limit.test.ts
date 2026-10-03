import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import type { AppEnv, Env } from '../src/env.js';
import { onError } from '../src/middleware/problem.js';
import { clientIp, rateLimit } from '../src/middleware/rate-limit.js';

function limiter(max: number) {
  const hits = new Map<string, number>();
  return {
    keys: hits,
    async limit({ key }: { key: string }) {
      const n = (hits.get(key) ?? 0) + 1;
      hits.set(key, n);
      return { success: n <= max };
    },
  };
}

function app(env: Partial<Env>) {
  const a = new Hono<AppEnv>();
  a.use('*', async (c, next) => {
    c.set('requestId', 'test');
    await next();
  });
  a.get('/x', rateLimit(), (c) => c.text('ok'));
  a.post('/publish', rateLimit('publish'), (c) => c.text('ok'));
  a.onError(onError);
  return (req: Request) => a.fetch(req, env as Env);
}

describe('rate limiting (api-spec §3)', () => {
  it('limits anonymous reads per IP and answers 429 with Retry-After', async () => {
    const pub = limiter(2);
    const fetch = app({ RL_PUBLIC: pub as unknown as RateLimit });
    const req = () => new Request('https://x/x', { headers: { 'cf-connecting-ip': '203.0.113.7' } });
    expect((await fetch(req())).status).toBe(200);
    expect((await fetch(req())).status).toBe(200);
    const res = await fetch(req());
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('60');
    expect(((await res.json()) as { code: string }).code).toBe('E_RATE_LIMITED');
    expect([...pub.keys.keys()]).toEqual(['public:ip:203.0.113.7']);
  });
  it('uses the token class and a hashed token key when authenticated', async () => {
    const auth = limiter(1);
    const fetch = app({ RL_AUTH: auth as unknown as RateLimit });
    const req = () => new Request('https://x/x', { headers: { authorization: 'Bearer gpm_secret' } });
    expect((await fetch(req())).status).toBe(200);
    expect((await fetch(req())).status).toBe(429);
    const key = [...auth.keys.keys()][0]!;
    expect(key).toMatch(/^auth:t:[0-9a-f]{24}$/);
    expect(key).not.toContain('secret');
  });
  it('applies route-specific classes and passes through without bindings', async () => {
    const pub = limiter(0);
    expect(
      (await app({ RL_PUBLISH: pub as unknown as RateLimit })(new Request('https://x/publish', { method: 'POST' })))
        .status,
    ).toBe(429);
    expect((await app({})(new Request('https://x/x'))).status).toBe(200);
    expect(clientIp(new Request('https://x', { headers: { 'x-real-ip': '1.2.3.4' } }))).toBe('1.2.3.4');
    expect(clientIp(new Request('https://x'))).toBe('0.0.0.0');
  });
});
