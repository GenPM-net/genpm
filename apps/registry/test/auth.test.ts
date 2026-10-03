// D3-A-01 / D3-A-02: device-flow exchange, tokens gpm_ (checksum, HMAC, scopes, expiración), /v1/me y logout.
import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { hashToken, isWellFormedToken, newToken } from '../src/services/tokens.js';
import { FakeGitHub } from './fake-github.js';
import { call } from './helpers.js';

const gh = new FakeGitHub().addUser('gho_valid_token_123', {
  id: 4242,
  login: 'yohangel',
  avatar_url: 'https://avatars.example/1',
  email: 'private@example.com',
  orgs: [
    { login: 'acme', id: 77, role: 'admin' },
    { login: 'friends', id: 78, role: 'member' },
  ],
});

async function exchange(githubToken: string, name?: string) {
  const res = await call(
    '/v1/auth/github/exchange',
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ githubToken, name }) },
    gh,
  );
  return { status: res.status, body: (await res.json()) as Record<string, unknown>, res };
}

describe('tokens', () => {
  it('have the gpm_ format with a valid checksum', () => {
    const t = newToken();
    expect(t).toMatch(/^gpm_[0-9A-Za-z]{49}$/);
    expect(isWellFormedToken(t)).toBe(true);
    expect(isWellFormedToken(`${t.slice(0, -1)}${t.endsWith('A') ? 'B' : 'A'}`)).toBe(false);
    expect(isWellFormedToken('gpm_short')).toBe(false);
  });
});

describe('POST /v1/auth/github/exchange', () => {
  it('upserts the account and org memberships by github id and returns a token once', async () => {
    const { status, body, res } = await exchange('gho_valid_token_123', 'cli@laptop');
    expect(status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(body['account']).toEqual({ handle: 'yohangel', orgs: ['acme', 'friends'] });
    const token = body['token'] as string;
    expect(isWellFormedToken(token)).toBe(true);
    const row = await env.DB.prepare(
      'SELECT token_hash, token_prefix, scopes, expires_at, name FROM api_tokens WHERE token_prefix = ?1',
    )
      .bind(token.slice(0, 8))
      .first<Record<string, unknown>>();
    expect(row?.['token_hash']).toBe(await hashToken(env.TOKEN_PEPPER!, token));
    expect(JSON.stringify(row)).not.toContain(token);
    expect(row?.['scopes']).toBe('["read","publish"]');
    expect(row?.['name']).toBe('cli@laptop');
    const days = ((row?.['expires_at'] as number) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(89);
    const roles = await env.DB.prepare(
      'SELECT a.handle, m.role FROM memberships m JOIN accounts a ON a.id = m.org_id WHERE m.user_id = (SELECT id FROM accounts WHERE github_id = 4242) ORDER BY a.handle',
    ).all();
    expect(roles.results).toEqual([
      { handle: 'acme', role: 'admin' },
      { handle: 'friends', role: 'publisher' },
    ]);
    // Segundo login: misma cuenta (por github_id), otro token
    const again = await exchange('gho_valid_token_123');
    expect(again.body['token']).not.toBe(token);
    const n = await env.DB.prepare('SELECT count(*) AS n FROM accounts WHERE github_id = 4242').first<{ n: number }>();
    expect(n?.n).toBe(1);
  });
  it('rejects invalid GitHub tokens and bad bodies', async () => {
    expect((await exchange('gho_invalid_token_000')).body['code']).toBe('E_AUTH');
    expect((await exchange('x')).body['code']).toBe('E_BAD_REQUEST');
  });
});

describe('GET /v1/me and logout', () => {
  it('describes the account and revokes the current token on logout', async () => {
    const token = (await exchange('gho_valid_token_123')).body['token'] as string;
    const auth = { authorization: `Bearer ${token}` };
    const me = await call('/v1/me', { headers: auth });
    expect(me.headers.get('cache-control')).toBe('private, no-store');
    expect(await me.json()).toMatchObject({
      handle: 'yohangel',
      github: 'yohangel',
      orgs: [
        { handle: 'acme', role: 'admin' },
        { handle: 'friends', role: 'publisher' },
      ],
      token: { name: 'cli', scopes: ['read', 'publish'], prefix: token.slice(0, 8) },
    });
    expect((await call('/v1/auth/logout', { method: 'POST', headers: auth })).status).toBe(200);
    const after = await call('/v1/me', { headers: auth });
    expect(after.status).toBe(401);
    expect(((await after.json()) as { code: string }).code).toBe('E_AUTH');
  });
  it('requires authentication', async () => {
    expect((await call('/v1/me')).status).toBe(401);
    expect((await call('/v1/me', { headers: { authorization: 'Bearer nope' } })).status).toBe(401);
  });
});
