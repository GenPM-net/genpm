// INV-8: revocación de claves de firma con lista firmada por la clave raíz offline, caché monótona.
import { webcrypto } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { importPrivateKey, type RevocationList, revocationPayload, signBytes } from '@genpm/manifest';
import { beforeEach, describe, expect, it } from 'vitest';
import { revokedKeys } from './revocation.js';

const b64 = (b: ArrayBuffer) => Buffer.from(b).toString('base64url');
async function keypair() {
  const kp = (await webcrypto.subtle.generateKey({ name: 'Ed25519' }, true, [
    'sign',
    'verify',
  ])) as webcrypto.CryptoKeyPair;
  return {
    pub: b64(await webcrypto.subtle.exportKey('raw', kp.publicKey)),
    priv: b64(await webcrypto.subtle.exportKey('pkcs8', kp.privateKey)),
  };
}
async function list(priv: string, issuedAt: number, revoked: string[]): Promise<RevocationList> {
  const base = { v: 1 as const, issuedAt, revoked };
  return { ...base, sig: await signBytes(await importPrivateKey(priv), revocationPayload(base)) };
}
const serving = (revocation: unknown) => ({ keys: async () => ({ revocation }) });
const offline = { keys: async (): Promise<{ revocation: unknown }> => Promise.reject(new TypeError('offline')) };

let root: { pub: string; priv: string };
let cacheDir: string;
const registry = 'https://api.genpm.net';

beforeEach(async () => {
  root ??= await keypair();
  cacheDir = await mkdtemp(join(tmpdir(), 'genpm-rev-'));
});

describe('revokedKeys', () => {
  it('accepts a list signed by the root key', async () => {
    const l = await list(root.priv, 1, ['k1']);
    expect(await revokedKeys({ registry, client: serving(l), cacheDir, rootKey: root.pub })).toEqual(['k1']);
  });

  it('ignores lists with a bad signature or the wrong root', async () => {
    const other = await keypair();
    const forged = await list(other.priv, 1, ['k2']);
    expect(await revokedKeys({ registry, client: serving(forged), cacheDir, rootKey: root.pub })).toEqual([]);
    const tampered = { ...(await list(root.priv, 1, ['k1'])), revoked: ['k1', 'k2'] };
    expect(await revokedKeys({ registry, client: serving(tampered), cacheDir, rootKey: root.pub })).toEqual([]);
    expect(await revokedKeys({ registry, client: serving({ nope: 1 }), cacheDir, rootKey: root.pub })).toEqual([]);
  });

  it('never un-revokes: a registry that drops or rolls back the list cannot undo a revocation', async () => {
    const opts = { registry, cacheDir, rootKey: root.pub };
    await revokedKeys({ ...opts, client: serving(await list(root.priv, 2, ['k1'])) });
    expect(await revokedKeys({ ...opts, client: serving(null) })).toEqual(['k1']);
    expect(await revokedKeys({ ...opts, client: offline })).toEqual(['k1']);
    expect(await revokedKeys({ ...opts, client: serving(await list(root.priv, 1, [])) })).toEqual(['k1']);
    expect(await revokedKeys({ ...opts, client: serving(await list(root.priv, 3, ['k2'])) })).toEqual(['k1', 'k2']);
  });

  it('keeps one cache per registry', async () => {
    await revokedKeys({ registry, cacheDir, rootKey: root.pub, client: serving(await list(root.priv, 1, ['k1'])) });
    expect(
      await revokedKeys({ registry: 'https://registry.acme.dev', cacheDir, rootKey: root.pub, client: serving(null) }),
    ).toEqual([]);
  });

  it('without a root key there is no revocation and no extra request', async () => {
    let calls = 0;
    const client = { keys: async () => (calls++, { revocation: null }) };
    expect(await revokedKeys({ registry, client, cacheDir, rootKey: null })).toEqual([]);
    expect(calls).toBe(0);
  });
});
