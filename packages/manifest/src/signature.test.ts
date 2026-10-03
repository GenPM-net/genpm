import { describe, expect, it } from 'vitest';
import { bytesToBase64Url } from './canonical.js';
import {
  importPrivateKey,
  parseSignature,
  parseSignatureHeader,
  revocationPayload,
  signatureHeader,
  signBytes,
  signManifest,
  verifyManifest,
  verifyRevocationList,
} from './signature.js';

async function keypair() {
  const kp = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  const pkcs8 = bytesToBase64Url(new Uint8Array(await crypto.subtle.exportKey('pkcs8', kp.privateKey)));
  const raw = bytesToBase64Url(new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey)));
  return { pkcs8, raw };
}

const manifest = {
  $: 1,
  n: '@core/db',
  v: '1.0.0',
  r: 'https://github.com/genpm-net/db',
  t: 'v1.0.0',
  c: 'a'.repeat(40),
  d: 'src/lib/db',
  i: '.',
  x: 'AGENTS.md',
  l: 'MIT',
};

describe('Ed25519 manifest signatures (INV-8)', () => {
  it('signs canonical form and verifies with pinned keys', async () => {
    const k1 = await keypair();
    const sg = await signManifest(manifest, 'k1', await importPrivateKey(k1.pkcs8));
    expect(sg).toMatch(/^k1:[A-Za-z0-9_-]{86}$/);
    expect(await verifyManifest(manifest, sg, { k1: k1.raw })).toEqual({ ok: true, keyId: 'k1' });
    // Orden de claves distinto y `sg` embebido: misma forma canónica
    const reordered = { sg, ...Object.fromEntries(Object.entries(manifest).reverse()) };
    expect(await verifyManifest(reordered, sg, { k1: k1.raw })).toEqual({ ok: true, keyId: 'k1' });
  });
  it('rejects tampering, unknown and revoked keys, malformed signatures', async () => {
    const k1 = await keypair();
    const k2 = await keypair();
    const sg = await signManifest(manifest, 'k1', await importPrivateKey(k1.pkcs8));
    expect(await verifyManifest({ ...manifest, c: 'b'.repeat(40) }, sg, { k1: k1.raw })).toEqual({
      ok: false,
      reason: 'bad_signature',
    });
    expect(await verifyManifest(manifest, sg, { k1: k2.raw })).toEqual({ ok: false, reason: 'bad_signature' });
    expect(await verifyManifest(manifest, sg, { k2: k2.raw })).toEqual({ ok: false, reason: 'unknown_key' });
    expect(await verifyManifest(manifest, sg, { k1: k1.raw }, ['k1'])).toEqual({ ok: false, reason: 'revoked_key' });
    expect(await verifyManifest(manifest, 'nope', { k1: k1.raw })).toEqual({ ok: false, reason: 'malformed' });
    expect(await verifyManifest(manifest, sg, { k1: 'not-a-key' })).toEqual({ ok: false, reason: 'bad_signature' });
  });
  it('converts to and from the HTTP header', () => {
    const sg = `k1:${'A'.repeat(86)}`;
    expect(signatureHeader(sg)).toBe(`keyid=k1,sig=${'A'.repeat(86)}`);
    expect(parseSignatureHeader(signatureHeader(sg))).toBe(sg);
    expect(parseSignatureHeader(null)).toBeNull();
    expect(signatureHeader('bad')).toBe('');
    expect(parseSignature(sg)).toEqual({ keyId: 'k1', sig: 'A'.repeat(86) });
  });
  it('verifies revocation lists signed by the offline root key', async () => {
    const root = await keypair();
    const list = { v: 1 as const, issuedAt: 1, revoked: ['k0'] };
    const sig = await signBytes(await importPrivateKey(root.pkcs8), revocationPayload(list));
    expect(await verifyRevocationList({ ...list, sig }, root.raw)).toBe(true);
    expect(await verifyRevocationList({ ...list, revoked: [], sig }, root.raw)).toBe(false);
  });
});
