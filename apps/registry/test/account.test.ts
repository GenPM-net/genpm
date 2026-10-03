import { env } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import { account, call, seed } from './helpers.js';

let web: string;
beforeAll(async () => {
  await seed();
  ({ token: web } = await account({ login: 'webuser' }));
  await env.DB.prepare("UPDATE api_tokens SET name = 'web' WHERE token_prefix = ?1").bind(web.slice(0, 8)).run();
});
const auth = (t: string) => ({ authorization: `Bearer ${t}`, 'content-type': 'application/json' });

describe('tokens (web)', () => {
  it('creates a token shown once, lists it by prefix and revokes it', async () => {
    const created = await call('/v1/tokens', {
      method: 'POST',
      headers: auth(web),
      body: JSON.stringify({ name: 'ci', scopes: ['publish'], days: 90 }),
    });
    expect(created.status).toBe(201);
    const { id, token } = (await created.json()) as { id: string; token: string };
    expect(token).toMatch(/^gpm_/);
    const list = (await (await call('/v1/tokens', { headers: auth(web) })).json()) as {
      tokens: Array<{ id: string; prefix: string }>;
    };
    expect(list.tokens.find((x) => x.id === id)?.prefix).toBe(token.slice(0, 8));
    expect(JSON.stringify(list)).not.toContain(token);
    expect((await call(`/v1/tokens/${id}`, { method: 'DELETE', headers: auth(web) })).status).toBe(200);
    expect((await call('/v1/me', { headers: auth(token) })).status).toBe(401);
  });
  it('requires a web session to create tokens', async () => {
    const { token: cli } = await account({ login: 'cliuser' });
    const r = await call('/v1/tokens', {
      method: 'POST',
      headers: auth(cli),
      body: JSON.stringify({ name: 'x', scopes: ['read'] }),
    });
    expect(r.status).toBe(401);
  });
});

describe('reports, leads and dashboard', () => {
  it('stores reports for existing packages', async () => {
    const r = await call('/v1/reports', {
      method: 'POST',
      headers: auth(web),
      body: JSON.stringify({ name: '@core/db', version: '1.0.3', reason: 'malware', details: 'x' }),
    });
    expect(r.status).toBe(201);
    expect(((await r.json()) as { id: string }).id).toMatch(/^rep_/);
    expect(
      (await call('/v1/reports', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }))
        .status,
    ).toBe(401);
  });
  it('accepts leads and rejects the honeypot', async () => {
    const ok = await call('/v1/leads', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'enterprise', email: 'a@b.co', company: 'Acme' }),
    });
    expect(ok.status).toBe(201);
    const bot = await call('/v1/leads', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'sponsor', email: 'a@b.co', website: 'spam' }),
    });
    expect(bot.status).toBe(400);
  });
  it('lists own packages and activity', async () => {
    const pk = await call('/v1/me/packages', { headers: auth(web) });
    expect(((await pk.json()) as { packages: unknown[] }).packages).toEqual([]);
    const act = await call('/v1/me/activity', { headers: auth(web) });
    expect(act.status).toBe(200);
  });
});
