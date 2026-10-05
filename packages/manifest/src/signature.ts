// Firma Ed25519 de manifiestos resueltos (security §4.3, INV-8). WebCrypto puro: Workers firma, CLI/MCP verifican.
// Formato: `sg` = `<keyid>:<base64url(signature)>` sobre la forma canónica (sin `sg`).

import { base64UrlToBytes, bytesToBase64Url, canonicalize } from './canonical.js';

const ED25519 = { name: 'Ed25519' } as const;

export type PublicKeys = Readonly<Record<string, string>>;

export async function importPrivateKey(pkcs8B64Url: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('pkcs8', base64UrlToBytes(pkcs8B64Url) as BufferSource, ED25519, false, ['sign']);
}

export async function importPublicKey(rawB64Url: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', base64UrlToBytes(rawB64Url) as BufferSource, ED25519, false, ['verify']);
}

export async function signBytes(key: CryptoKey, data: string): Promise<string> {
  const sig = await crypto.subtle.sign(ED25519, key, new TextEncoder().encode(data));
  return bytesToBase64Url(new Uint8Array(sig));
}

export async function verifyBytes(publicKeyB64Url: string, data: string, sigB64Url: string): Promise<boolean> {
  try {
    const key = await importPublicKey(publicKeyB64Url);
    return await crypto.subtle.verify(
      ED25519,
      key,
      base64UrlToBytes(sigB64Url) as BufferSource,
      new TextEncoder().encode(data),
    );
  } catch {
    return false;
  }
}

/** Firma la forma canónica del manifiesto resuelto → `sg`. */
export async function signManifest(
  manifest: Record<string, unknown>,
  keyId: string,
  privateKey: CryptoKey,
): Promise<string> {
  return `${keyId}:${await signBytes(privateKey, canonicalize(manifest))}`;
}

/**
 * Registro firmado de la copia en R2 de una versión (Verified Archive, V03-02): `h` = sha256 hex del tar.gz.
 * Se firma y verifica igual que un manifiesto (forma canónica), con un `$` distinto para que no se confundan.
 */
export function archiveRecord(a: { n: string; v: string; c: string; h: string }): Record<string, unknown> {
  // La forma canónica solo conserva las claves del manifiesto y las `_*`: el hash va en `_sha256` para quedar firmado.
  return { $: 'archive', n: a.n, v: a.v, c: a.c, _sha256: a.h };
}

export function parseSignature(sg: string): { keyId: string; sig: string } | null {
  const m = sg.match(/^([a-z0-9][a-z0-9_-]{0,31}):([A-Za-z0-9_-]{40,200})$/);
  return m ? { keyId: m[1]!, sig: m[2]! } : null;
}

/** Cabecera HTTP `genpm-signature: keyid=<id>,sig=<base64url>` (api-spec §1). */
export function signatureHeader(sg: string): string {
  const p = parseSignature(sg);
  return p ? `keyid=${p.keyId},sig=${p.sig}` : '';
}

export function parseSignatureHeader(header: string | null | undefined): string | null {
  const m = header?.match(/^keyid=([^,\s]+),\s*sig=([A-Za-z0-9_-]+)$/);
  return m ? `${m[1]}:${m[2]}` : null;
}

export type VerifyResult =
  | { ok: true; keyId: string }
  | { ok: false; reason: 'malformed' | 'unknown_key' | 'revoked_key' | 'bad_signature' };

/**
 * Verifica `sg` contra el manifiesto con las claves públicas fijadas (y la lista de revocación).
 * El manifiesto puede traer `sg` dentro: la forma canónica lo excluye.
 */
export async function verifyManifest(
  manifest: Record<string, unknown>,
  sg: string,
  keys: PublicKeys,
  revoked: readonly string[] = [],
): Promise<VerifyResult> {
  const p = parseSignature(sg);
  if (!p) return { ok: false, reason: 'malformed' };
  if (revoked.includes(p.keyId)) return { ok: false, reason: 'revoked_key' };
  const pub = keys[p.keyId];
  if (!pub) return { ok: false, reason: 'unknown_key' };
  return (await verifyBytes(pub, canonicalize(manifest), p.sig))
    ? { ok: true, keyId: p.keyId }
    : { ok: false, reason: 'bad_signature' };
}

/** Lista de revocación firmada por la clave raíz offline (security §4.3). */
export type RevocationList = { v: 1; issuedAt: number; revoked: string[]; sig: string };

export function revocationPayload(list: Pick<RevocationList, 'v' | 'issuedAt' | 'revoked'>): string {
  return JSON.stringify({ v: list.v, issuedAt: list.issuedAt, revoked: [...list.revoked].sort() });
}

export async function verifyRevocationList(list: RevocationList, rootPublicKey: string): Promise<boolean> {
  return verifyBytes(rootPublicKey, revocationPayload(list), list.sig);
}
