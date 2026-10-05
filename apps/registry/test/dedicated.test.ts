// ENT-01: tenancy dedicada (Workers for Platforms). El compartido enruta; el dedicado solo sirve su registro.
import { env } from 'cloudflare:test';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { fanOutCron } from '../src/services/dedicated.js';
import { call } from './helpers.js';

const seen: Array<{ script: string; url: string; registry: string | null }> = [];
const DISPATCHER = {
  get: (script: string) => ({
    fetch: async (req: Request) => {
      seen.push({ script, url: req.url, registry: req.headers.get('genpm-registry') });
      return Response.json({ from: script });
    },
  }),
};

beforeAll(async () => {
  await env.DB.prepare(
    `INSERT INTO registries (id, slug, owner_id, plan, is_public, isolation, settings, created_at)
     VALUES ('reg_bigco', 'bigco', NULL, 'enterprise', 0, 'dedicated', '{"dispatch":{"script":"tenant-bigco"}}', 1)`,
  ).run();
});
afterEach(() => {
  Object.assign(env, { DISPATCHER: undefined, DEDICATED_TENANT: undefined, CRON_SECRET: undefined });
  seen.length = 0;
});

describe('dedicated tenancy', () => {
  it('forwards every request for a dedicated registry to its own Worker', async () => {
    Object.assign(env, { DISPATCHER });
    const res = await call('/r/bigco/v1/search?q=x');
    expect(await res.json()).toEqual({ from: 'tenant-bigco' });
    expect(seen[0]).toMatchObject({ script: 'tenant-bigco', registry: 'bigco' });
    expect(new URL(seen[0]!.url).pathname).toBe('/v1/search');
    // El público nunca se reenvía.
    expect((await call('/v1/search?q=x')).status).toBe(200);
    expect(seen).toHaveLength(1);
  });

  it('fails closed without the dispatch binding', async () => {
    expect((await call('/r/bigco/v1/search?q=x')).status).toBe(500);
  });

  it('a dedicated Worker serves only its registry and runs the forwarded cron', async () => {
    Object.assign(env, { DEDICATED_TENANT: 'bigco', CRON_SECRET: 'c' });
    expect((await call('/v1/search?q=x')).status).toBe(404);
    expect((await call('/__cron', { method: 'POST', body: '{"cron":"0 4 * * SUN"}' })).status).toBe(404);
    const ok = await call('/__cron', {
      method: 'POST',
      headers: { 'x-genpm-cron': 'c' },
      body: '{"cron":"0 4 * * SUN"}',
    });
    expect(ok.status).toBe(200);
  });

  it('the shared Worker fans the cron out to dedicated Workers', async () => {
    Object.assign(env, { DISPATCHER, CRON_SECRET: 'c' });
    expect(await fanOutCron(env, '0 * * * *')).toBe(1);
    expect(new URL(seen[0]!.url).pathname).toBe('/__cron');
  });
});

describe('login on a private registry', () => {
  it('reaches the auth routes without a token (no registry data involved)', async () => {
    await env.DB.prepare(
      "INSERT OR IGNORE INTO registries (id, slug, owner_id, plan, is_public, isolation, created_at) VALUES ('reg_privlogin', 'privlogin', NULL, 'team', 0, 'shared', 1)",
    ).run();
    const res = await call('/r/privlogin/v1/auth/github/exchange', {
      method: 'POST',
      body: '{}',
      headers: { 'content-type': 'application/json' },
    });
    expect(res.status).toBe(400);
    expect((await call('/r/privlogin/v1/keys')).status).toBe(200);
    expect((await call('/r/privlogin/v1/search?q=x')).status).toBe(404);
  });
});
