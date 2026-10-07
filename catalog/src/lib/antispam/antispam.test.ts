import { beforeEach, describe, expect, it } from 'vitest';
import { testDb } from '../db/__fixtures__/pglite.ts';
import type { Db } from '../db/index.ts';
import * as schema from './schema.ts';
import {
  captchaFromEnv,
  checkFormTiming,
  clientIp,
  formTimingToken,
  pruneRateLimits,
  rateLimit,
  rateLimits,
  verifyCaptcha,
  verifyHuman,
} from './index.ts';

let db: Db;
beforeEach(async () => {
  db = await testDb(schema);
  process.env.ANTISPAM_SECRET = 'a'.repeat(40);
  delete process.env.TURNSTILE_SECRET_KEY;
  delete process.env.HCAPTCHA_SECRET_KEY;
});

const fakeCaptcha = (success: boolean, seen: URLSearchParams[] = []) =>
  (async (_url: unknown, init?: RequestInit) => {
    seen.push(init?.body as URLSearchParams);
    return Response.json({ success });
  }) as typeof fetch;

describe('rateLimit', () => {
  it('counts per fixed window and resets in the next one', async () => {
    const now = new Date('2026-01-01T00:00:10Z');
    const opts = { limit: 2, windowMs: 60_000, now };
    expect((await rateLimit('k', opts)).remaining).toBe(1);
    expect((await rateLimit('k', opts)).ok).toBe(true);
    const third = await rateLimit('k', opts);
    expect(third).toMatchObject({ ok: false, remaining: 0, retryAfterSeconds: 50 });
    expect((await rateLimit('other', opts)).ok).toBe(true);
    expect((await rateLimit('k', { ...opts, now: new Date('2026-01-01T00:01:01Z') })).ok).toBe(true);
  });

  it('stores only hashed keys and prunes expired windows', async () => {
    await rateLimit('forms:contact:203.0.113.7', { limit: 5, windowMs: 1000, now: new Date(0) });
    const rows = await db.select().from(rateLimits);
    expect(rows[0]!.key).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(rows)).not.toContain('203.0.113.7');
    expect(await pruneRateLimits(new Date(5000))).toBe(1);
  });

  it('requires a strong secret', async () => {
    process.env.ANTISPAM_SECRET = 'short';
    await expect(rateLimit('k', { limit: 1, windowMs: 1000 })).rejects.toThrow(/ANTISPAM_SECRET/);
  });
});

describe('form timing', () => {
  it('accepts human-speed submissions only', async () => {
    const t = await formTimingToken(1_000_000);
    expect(await checkFormTiming(t, { now: 1_000_500 })).toBe('too_fast');
    expect(await checkFormTiming(t, { now: 1_005_000 })).toBe('ok');
    expect(await checkFormTiming(t, { now: 1_000_000 + 2 * 86_400_000 })).toBe('expired');
    expect(await checkFormTiming(t.replace(/^\d+/, '1'), { now: 1_005_000 })).toBe('invalid');
    expect(await checkFormTiming(undefined)).toBe('invalid');
  });
});

describe('captcha', () => {
  it('picks the provider from env', () => {
    expect(captchaFromEnv({})).toBeNull();
    expect(captchaFromEnv({ TURNSTILE_SECRET_KEY: 's' })?.provider).toBe('turnstile');
    expect(captchaFromEnv({ HCAPTCHA_SECRET_KEY: 's' })?.provider).toBe('hcaptcha');
  });

  it('posts secret, response and IP, and fails closed', async () => {
    const seen: URLSearchParams[] = [];
    const cfg = { provider: 'turnstile' as const, secret: 'sec' };
    expect(await verifyCaptcha('tok', cfg, { remoteIp: '1.2.3.4', fetch: fakeCaptcha(true, seen) })).toBe(true);
    expect(Object.fromEntries(seen[0]!)).toEqual({ secret: 'sec', response: 'tok', remoteip: '1.2.3.4' });
    expect(await verifyCaptcha('tok', cfg, { fetch: fakeCaptcha(false) })).toBe(false);
    expect(await verifyCaptcha('', cfg, { fetch: fakeCaptcha(true) })).toBe(false);
    const broken = (async () => {
      throw new Error('network');
    }) as unknown as typeof fetch;
    expect(await verifyCaptcha('tok', cfg, { fetch: broken })).toBe(false);
  });
});

describe('clientIp', () => {
  it('never trusts client-settable headers unless configured; x-forwarded-for counts from the right', () => {
    const h = new Headers({ 'cf-connecting-ip': '1.1.1.1', 'x-real-ip': '4.4.4.4', 'x-forwarded-for': '9.9.9.9, 2.2.2.2' });
    expect(clientIp(h, {})).toBe('2.2.2.2'); // el cliente no elige su IP con cf-connecting-ip ni con el primer salto
    expect(clientIp(h, { ANTISPAM_TRUSTED_PROXIES: '2' })).toBe('9.9.9.9');
    expect(clientIp(h, { ANTISPAM_TRUSTED_PROXIES: '5' })).toBe('9.9.9.9');
    expect(clientIp(h, { ANTISPAM_IP_HEADER: 'CF-Connecting-IP' })).toBe('1.1.1.1');
    expect(clientIp(h, { ANTISPAM_IP_HEADER: 'x-real-ip' })).toBe('4.4.4.4');
    expect(clientIp(new Headers({ 'x-forwarded-for': '2.2.2.2' }), { ANTISPAM_IP_HEADER: 'cf-connecting-ip' })).toBeNull();
    expect(clientIp(new Headers({ 'x-forwarded-for': '2001:db8::1' }), {})).toBe('2001:db8::1');
    expect(clientIp(new Headers({ 'x-forwarded-for': '<script>' }), {})).toBeNull();
    expect(clientIp(new Headers(), {})).toBeNull();
  });
});

describe('verifyHuman', () => {
  const headers = new Headers({ 'x-forwarded-for': '198.51.100.1' });
  const now = new Date(1_000_000 + 10_000);

  it('passes a normal submission and rejects honeypot, missing token and floods', async () => {
    const ts = await formTimingToken(1_000_000);
    const opts = { scope: 'forms:contact', limit: 2, now, captcha: null };
    expect(await verifyHuman(headers, { _ts: ts, website: '' }, opts)).toEqual({ ok: true });
    expect(await verifyHuman(headers, { _ts: ts, website: 'http://spam' }, opts)).toEqual({ ok: false, reason: 'honeypot' });
    expect(await verifyHuman(headers, {}, opts)).toEqual({ ok: false, reason: 'invalid_token' });
    expect((await verifyHuman(headers, { _ts: ts }, opts)).ok).toBe(true);
    const r = await verifyHuman(headers, { _ts: ts }, opts);
    expect(r).toMatchObject({ ok: false, reason: 'rate_limited' });
  });

  it('checks the captcha field of the configured provider (FormData)', async () => {
    const fd = new FormData();
    fd.set('_ts', await formTimingToken(1_000_000));
    fd.set('cf-turnstile-response', 'tok');
    const captcha = { provider: 'turnstile' as const, secret: 's' };
    expect(await verifyHuman(headers, fd, { scope: 'c', now, captcha, fetch: fakeCaptcha(true) })).toEqual({ ok: true });
    expect(await verifyHuman(headers, fd, { scope: 'c', now, captcha, fetch: fakeCaptcha(false) })).toEqual({
      ok: false,
      reason: 'captcha',
    });
  });
});
