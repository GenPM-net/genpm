// V10-02: SSO OIDC por organización (vinculación, JIT, enforce) con un IdP falso.
import { env } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import { __resetJwks } from '../src/services/oidc.js';
import type { FakeGitHub } from './fake-github.js';
import { account, call } from './helpers.js';

const ISS = 'https://idp.example';
let keys: CryptoKeyPair;
let jwk: JsonWebKey;
const b64 = (o: unknown) =>
  btoa(typeof o === 'string' ? o : JSON.stringify(o))
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
async function idToken(claims: Record<string, unknown>) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'RS256', kid: 'i1' });
  const body = b64({ iss: ISS, aud: 'genpm-client', exp: now + 300, iat: now, ...claims });
  const sig = new Uint8Array(
    await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keys.privateKey, new TextEncoder().encode(`${head}.${body}`)),
  );
  return `${head}.${body}.${b64(String.fromCharCode(...sig))}`;
}

/** IdP falso: discovery, JWKS y token endpoint que firma un id_token con el nonce y el `sub` dados. */
const idp = (next: { sub: string; email: string; nonce?: string }) =>
  ({
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input instanceof Request ? input.url : input));
      if (url.pathname === '/.well-known/openid-configuration')
        return Response.json({
          issuer: ISS,
          authorization_endpoint: `${ISS}/authorize`,
          token_endpoint: `${ISS}/token`,
          jwks_uri: `${ISS}/keys`,
        });
      if (url.pathname === '/keys') return Response.json({ keys: [{ ...jwk, kid: 'i1', alg: 'RS256' }] });
      if (url.pathname === '/token') {
        const form = new URLSearchParams(String(init?.body ?? ''));
        if (form.get('client_secret') !== 's3cret' || !form.get('code_verifier'))
          return new Response('', { status: 401 });
        return Response.json({
          id_token: await idToken({ sub: next.sub, email: next.email, email_verified: true, nonce: next.nonce }),
        });
      }
      return new Response('', { status: 404 });
    },
  }) as unknown as FakeGitHub;

const req = (token: string, body?: unknown, method = body === undefined ? 'GET' : 'POST') => ({
  method,
  headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

let owner: string;
let dev: string;
beforeAll(async () => {
  keys = (await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  jwk = (await crypto.subtle.exportKey('jwk', keys.publicKey)) as JsonWebKey;
  __resetJwks();
  ({ token: owner } = await account({ login: 'ssoowner', orgs: [{ login: 'ssocorp', role: 'owner' }] }));
  ({ token: dev } = await account({ login: 'ssodev' }));
  await call('/v1/registries', req(owner, { slug: 'ssocorp-int', owner: 'ssocorp' }));
});

async function login(token: string, sub: string, email: string) {
  const start = await call(
    '/v1/auth/sso/ssocorp/start',
    req(token, { redirectUri: 'https://genpm.net/auth/sso/callback' }),
  );
  const url = new URL(((await start.json()) as { url: string }).url);
  expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  const nonce = url.searchParams.get('nonce')!;
  return call(
    '/v1/auth/sso/callback',
    req(token, { code: 'c0de', state: url.searchParams.get('state') }),
    idp({ sub, email, nonce }),
  );
}

describe('SSO (OIDC)', () => {
  it('org admins configure the IdP from its discovery document; the secret is never returned', async () => {
    const put = await call(
      '/v1/orgs/ssocorp/sso',
      req(
        owner,
        { issuer: ISS, clientId: 'genpm-client', clientSecret: 's3cret', domains: ['corp.example'], enforce: true },
        'PUT',
      ),
      idp({ sub: 'x', email: 'x' }),
    );
    expect(put.status).toBe(200);
    const cfg = (await (await call('/v1/orgs/ssocorp/sso', req(owner))).json()) as Record<string, unknown>;
    expect(cfg).toMatchObject({ enabled: true, tokenEndpoint: `${ISS}/token`, enforce: true });
    expect(JSON.stringify(cfg)).not.toContain('s3cret');
    const row = await env.DB.prepare('SELECT config FROM sso_connections').first<{ config: string }>();
    expect(row!.config).not.toContain('s3cret');
    expect(
      (
        await call(
          '/v1/orgs/ssocorp/sso',
          req(owner, { issuer: 'http://169.254.169.254', clientId: 'x', clientSecret: 'y' }, 'PUT'),
        )
      ).status,
    ).toBe(400);
  });

  it('links the identity, provisions membership just in time and enforces SSO for registry access', async () => {
    expect(
      (await call('/v1/auth/sso/ssocorp/start', req(dev, { redirectUri: 'https://evil.example/cb' }))).status,
    ).toBe(400);
    // Dominio de correo fuera de los permitidos.
    expect((await login(dev, 'u-1', 'dev@gmail.com')).status).toBe(403);
    const ok = await login(dev, 'u-1', 'dev@corp.example');
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ org: 'ssocorp', email: 'dev@corp.example' });
    expect((await call('/r/ssocorp-int/v1/search?q=x', req(dev))).status).toBe(200);
    // El admin desvincula: con enforce, el acceso derivado de la org se corta.
    expect((await call('/v1/orgs/ssocorp/sso/identities/ssodev', req(owner, undefined, 'DELETE'))).status).toBe(200);
    expect((await call('/r/ssocorp-int/v1/search?q=x', req(dev))).status).toBe(404);
    // Una identidad desactivada no se reactiva sola, y otra cuenta no puede apropiarse de ella.
    expect((await login(dev, 'u-1', 'dev@corp.example')).status).toBe(403);
    expect((await login(owner, 'u-1', 'dev@corp.example')).status).toBe(403);
    // El owner nunca queda fuera aunque no tenga identidad vinculada.
    expect((await call('/r/ssocorp-int/v1/search?q=x', req(owner))).status).toBe(200);
  });

  it('rejects a state from another account or a tampered id_token', async () => {
    const start = await call(
      '/v1/auth/sso/ssocorp/start',
      req(owner, { redirectUri: 'https://genpm.net/auth/sso/callback' }),
    );
    const url = new URL(((await start.json()) as { url: string }).url);
    const stolen = await call(
      '/v1/auth/sso/callback',
      req(dev, { code: 'c0de', state: url.searchParams.get('state') }),
      idp({ sub: 'u-2', email: 'o@corp.example', nonce: url.searchParams.get('nonce')! }),
    );
    expect(stolen.status).toBe(401);
    const wrongNonce = await call(
      '/v1/auth/sso/callback',
      req(owner, { code: 'c0de', state: url.searchParams.get('state') }),
      idp({ sub: 'u-2', email: 'o@corp.example', nonce: 'other' }),
    );
    expect(wrongNonce.status).toBe(401);
  });
});

describe('SCIM 2.0 (ENT-02)', () => {
  it('provisions, links on first SSO login and deprovisions with immediate effect', async () => {
    const t = await call('/v1/orgs/ssocorp/sso/scim-token', req(owner, {}));
    expect(t.status).toBe(201);
    const { token: scimToken, baseUrl } = (await t.json()) as { token: string; baseUrl: string };
    expect(baseUrl).toBe('https://api.genpm.net/scim/v2/ssocorp');
    const scimReq = (body?: unknown, method = body === undefined ? 'GET' : 'POST') => ({
      method,
      headers: { authorization: `Bearer ${scimToken}`, 'content-type': 'application/scim+json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    expect((await call('/scim/v2/ssocorp/Users', { headers: { authorization: `Bearer ${owner}` } })).status).toBe(401);
    const created = await call(
      '/scim/v2/ssocorp/Users',
      scimReq({ schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'], userName: 'Ana@corp.example', active: true }),
    );
    expect(created.status).toBe(201);
    const ana = (await created.json()) as { id: string; userName: string; active: boolean };
    expect(ana).toMatchObject({ userName: 'ana@corp.example', active: true });
    expect((await call('/scim/v2/ssocorp/Users', scimReq({ userName: 'ana@corp.example' }))).status).toBe(409);
    const found = (await (
      await call('/scim/v2/ssocorp/Users?filter=userName%20eq%20%22ana@corp.example%22', scimReq())
    ).json()) as {
      totalResults: number;
    };
    expect(found.totalResults).toBe(1);

    // Ana entra por SSO con su sub del IdP: se vincula a la identidad que creó SCIM.
    const anaAcc = await account({ login: 'ana' });
    expect((await login(anaAcc.token, 'okta-ana', 'ana@corp.example')).status).toBe(200);
    expect((await call('/r/ssocorp-int/v1/search?q=x', req(anaAcc.token))).status).toBe(200);

    // Baja desde el IdP: PATCH active=false corta el acceso y quita la membresía del SSO.
    const patch = await call(
      `/scim/v2/ssocorp/Users/${ana.id}`,
      scimReq(
        {
          schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
          Operations: [{ op: 'replace', path: 'active', value: false }],
        },
        'PATCH',
      ),
    );
    expect(((await patch.json()) as { active: boolean }).active).toBe(false);
    expect((await call('/r/ssocorp-int/v1/search?q=x', req(anaAcc.token))).status).toBe(404);
    const m = await env.DB.prepare(
      "SELECT count(*) AS n FROM memberships WHERE org_id = 'acc_org_ssocorp' AND user_id = ?1",
    )
      .bind(anaAcc.id)
      .first<{ n: number }>();
    expect(m!.n).toBe(0);
    expect((await login(anaAcc.token, 'okta-ana', 'ana@corp.example')).status).toBe(403);
    expect((await call(`/scim/v2/ssocorp/Users/${ana.id}`, scimReq(undefined, 'DELETE'))).status).toBe(204);
    expect((await call('/scim/v2/ssocorp/Users/nope', scimReq())).status).toBe(404);
  });
});
