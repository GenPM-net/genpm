// Cifrado de secretos guardados en D1 (V10-02: client_secret de los IdP). AES-GCM con una clave derivada de
// TOKEN_PEPPER por HKDF y un `info` por uso: sin secreto nuevo que gestionar, y rotar el pepper invalida todo.

import { base64UrlToBytes, bytesToBase64Url } from '@genpm/manifest';

async function key(pepper: string, info: string): Promise<CryptoKey> {
  const raw = await crypto.subtle.importKey('raw', new TextEncoder().encode(pepper), 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(16), info: new TextEncoder().encode(info) },
    raw,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function seal(pepper: string, info: string, plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(pepper, info), new TextEncoder().encode(plain)),
  );
  return `${bytesToBase64Url(iv)}.${bytesToBase64Url(ct)}`;
}

export async function open(pepper: string, info: string, sealed: string): Promise<string | null> {
  const [iv, ct] = sealed.split('.');
  if (!iv || !ct) return null;
  try {
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64UrlToBytes(iv) as Uint8Array<ArrayBuffer> },
      await key(pepper, info),
      base64UrlToBytes(ct) as Uint8Array<ArrayBuffer>,
    );
    return new TextDecoder().decode(pt);
  } catch {
    return null;
  }
}
