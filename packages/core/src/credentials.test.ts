import { describe, expect, it } from 'vitest';
import { oidcToken } from './credentials.js';

describe('oidcToken (trusted publishing)', () => {
  it('asks Actions for an OIDC token with audience genpm and exchanges it', async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      if (url.startsWith('https://actions.example')) {
        expect((init?.headers as Record<string, string>).authorization).toBe('bearer req-token');
        return Response.json({ value: 'jwt.from.actions' });
      }
      expect(JSON.parse(String(init?.body))).toEqual({ token: 'jwt.from.actions' });
      return Response.json({ token: 'gpm_short' });
    }) as typeof fetch;
    const env = {
      ACTIONS_ID_TOKEN_REQUEST_URL: 'https://actions.example/token?api-version=2.0',
      ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'req-token',
    };
    expect(await oidcToken('https://api.genpm.net', { env, fetchImpl })).toBe('gpm_short');
    expect(calls).toEqual([
      'GET https://actions.example/token?api-version=2.0&audience=genpm',
      'POST https://api.genpm.net/v1/auth/oidc/exchange',
    ]);
  });
  it('returns null outside Actions, when disabled or when the registry refuses', async () => {
    const no = (async () => new Response('', { status: 401 })) as unknown as typeof fetch;
    expect(await oidcToken('https://api.genpm.net', { env: {} })).toBeNull();
    const env = { ACTIONS_ID_TOKEN_REQUEST_URL: 'https://a', ACTIONS_ID_TOKEN_REQUEST_TOKEN: 't' };
    expect(await oidcToken('https://api.genpm.net', { env: { ...env, GENPM_OIDC: '0' } })).toBeNull();
    expect(await oidcToken('https://api.genpm.net', { env, fetchImpl: no })).toBeNull();
  });
});
