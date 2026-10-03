// Firma Ed25519 del manifiesto resuelto canónico con la clave `active` (security §4.3, INV-8).
// La clave privada vive solo en el secreto SIGNING_KEYS; las públicas se publican en GET /v1/keys.

import { importPrivateKey, signManifest } from '@genpm/manifest';
import type { Env } from '../env.js';
import { httpError } from '../http.js';

let cached: { raw: string; keyId: string; key: CryptoKey } | null = null;

export async function activeSigningKey(env: Env): Promise<{ keyId: string; key: CryptoKey }> {
  const keyId = env.SIGNING_KEY_ID ?? 'k1';
  const raw = env.SIGNING_KEYS ?? '';
  if (cached && cached.raw === raw && cached.keyId === keyId) return cached;
  let pkcs8: string | undefined;
  try {
    pkcs8 = (JSON.parse(raw) as Record<string, string>)[keyId];
  } catch {
    pkcs8 = undefined;
  }
  if (!pkcs8) throw httpError('E_INTERNAL', {}, { cause: 'signing key not configured' });
  cached = { raw, keyId, key: await importPrivateKey(pkcs8) };
  return cached;
}

export async function sign(env: Env, manifest: Record<string, unknown>): Promise<string> {
  const { keyId, key } = await activeSigningKey(env);
  return signManifest(manifest, keyId, key);
}
