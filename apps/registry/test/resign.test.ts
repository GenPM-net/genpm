// D6-S-08: rotación de la clave de firma. Al cambiar SIGNING_KEY_ID, el cron re-firma por lotes todas las versiones
// con la clave nueva, para poder revocar la anterior sin romper instalaciones (security §4.3, INV-8).
import { env } from 'cloudflare:test';
import { verifyManifest } from '@genpm/manifest';
import { beforeAll, describe, expect, it } from 'vitest';
import { resignStale } from '../src/cron/index.js';
import type { Env } from '../src/env.js';
import { seed } from './helpers.js';

const b64 = (b: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(b)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

let next: { pub: string; priv: string };

beforeAll(async () => {
  await seed();
  const kp = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  next = {
    pub: b64((await crypto.subtle.exportKey('raw', kp.publicKey)) as ArrayBuffer),
    priv: b64((await crypto.subtle.exportKey('pkcs8', kp.privateKey)) as ArrayBuffer),
  };
});

describe('signing key rotation', () => {
  it('re-signs every version with the new active key, in batches, and is idempotent', async () => {
    const before = await env.DB.prepare('SELECT COUNT(*) AS n FROM package_versions').first<{ n: number }>();
    expect(before!.n).toBeGreaterThan(0);
    const rotated = {
      ...env,
      SIGNING_KEY_ID: 'k2',
      SIGNING_KEYS: JSON.stringify({ ...JSON.parse(env.SIGNING_KEYS ?? '{}'), k2: next.priv }),
    } as Env;

    let total = 0;
    for (let i = 0; i < 10; i++) {
      const n = await resignStale(rotated, 2);
      total += n;
      if (n === 0) break;
    }
    expect(total).toBe(before!.n);
    expect(await resignStale(rotated, 2)).toBe(0);

    const { results } = await env.DB.prepare('SELECT manifest, signature FROM package_versions').all<{
      manifest: string;
      signature: string;
    }>();
    for (const r of results) {
      expect(r.signature.startsWith('k2:')).toBe(true);
      const ok = await verifyManifest(JSON.parse(r.manifest), r.signature, { k2: next.pub }, ['dev1']);
      expect(ok).toEqual({ ok: true, keyId: 'k2' });
    }
  });
});
