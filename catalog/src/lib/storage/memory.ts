// Driver en memoria y driver local (disco) para desarrollo y tests. Las subidas firmadas apuntan a una ruta de la
// propia app (`uploadPath`) que valida un token HMAC y escribe con `handleLocalUpload`.
import { assertSafeKey, isPublicKey, StorageError } from './keys.js';
import { checkSize } from './s3.js';
import { type ObjectInfo, type PutBody, type PutOptions, type StorageProvider, streamOf, toBytes } from './provider.js';

export type Backend = {
  write(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  read(key: string): Promise<{ bytes: Uint8Array; contentType: string } | null>;
  remove(key: string): Promise<void>;
};

export type LocalConfig = {
  /** Secreto para firmar subidas y descargas locales (≥ 32 caracteres). */
  secret: string;
  /** Origen de la app, p. ej. `http://localhost:3000`. */
  baseUrl: string;
  /** Ruta que monta `handleLocalUpload` / `handleLocalDownload`. */
  routePath?: string;
};

const enc = new TextEncoder();
// base64url sin Buffer (funciona también en Workers y navegador).
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
const fromB64url = (s: string) => Uint8Array.from(atob(s.replaceAll('-', '+').replaceAll('_', '/')), (c) => c.charCodeAt(0));

async function hmac(secret: string, data: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(data))));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

type Grant = { op: 'put' | 'get'; key: string; exp: number; size?: number; type?: string };

export async function signGrant(secret: string, g: Grant): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(g)));
  return `${body}.${await hmac(secret, body)}`;
}

export async function verifyGrant(secret: string, token: string | null): Promise<Grant> {
  const [body, sig] = (token ?? '').split('.');
  if (!body || !sig || !timingSafeEqual(sig, await hmac(secret, body))) throw new StorageError('invalid_token');
  const g = JSON.parse(new TextDecoder().decode(fromB64url(body))) as Grant;
  if (g.exp < Date.now()) throw new StorageError('invalid_token', 'expired');
  return g;
}

export function backendStorage(driver: 'local' | 'memory', backend: Backend, cfg: LocalConfig): StorageProvider {
  if (cfg.secret.length < 32) throw new Error('STORAGE_SECRET must be >= 32 chars');
  const route = `${cfg.baseUrl.replace(/\/+$/, '')}${cfg.routePath ?? '/api/storage'}`;
  return {
    driver,
    async put(key: string, body: PutBody, opts: PutOptions): Promise<ObjectInfo> {
      const bytes = await toBytes(body);
      await backend.write(assertSafeKey(key), bytes, opts.contentType);
      return { key, size: bytes.byteLength, contentType: opts.contentType };
    },
    async get(key) {
      const o = await backend.read(assertSafeKey(key));
      return o ? { key, size: o.bytes.byteLength, contentType: o.contentType, body: streamOf(o.bytes) } : null;
    },
    async head(key) {
      const o = await backend.read(assertSafeKey(key));
      return o ? { key, size: o.bytes.byteLength, contentType: o.contentType } : null;
    },
    delete: (key) => backend.remove(assertSafeKey(key)),
    async presignUpload(key, opts) {
      assertSafeKey(key);
      checkSize(opts);
      const exp = Date.now() + (opts.expiresIn ?? 600) * 1000;
      const token = await signGrant(cfg.secret, { op: 'put', key, exp, size: opts.size, type: opts.contentType });
      return { url: `${route}?token=${token}`, method: 'PUT', headers: { 'content-type': opts.contentType }, expiresAt: new Date(exp) };
    },
    async presignDownload(key, expiresIn = 300) {
      assertSafeKey(key);
      return `${route}?token=${await signGrant(cfg.secret, { op: 'get', key, exp: Date.now() + expiresIn * 1000 })}`;
    },
    publicUrl(key) {
      assertSafeKey(key);
      if (!isPublicKey(key)) throw new StorageError('not_public', `not a public key: ${key}`);
      return `${route}/${key}`;
    },
  };
}

export function memoryBackend(): Backend & { files: Map<string, { bytes: Uint8Array; contentType: string }> } {
  const files = new Map<string, { bytes: Uint8Array; contentType: string }>();
  return {
    files,
    write: async (key, bytes, contentType) => void files.set(key, { bytes, contentType }),
    read: async (key) => files.get(key) ?? null,
    remove: async (key) => void files.delete(key),
  };
}

/** Disco local (solo desarrollo): `dir/<clave>` y `dir/<clave>.type` con el content-type. */
export function diskBackend(dir: string): Backend {
  const path = async () => import('node:path');
  const fs = async () => import('node:fs/promises');
  const file = async (key: string) => (await path()).join(dir, ...key.split('/'));
  return {
    async write(key, bytes, contentType) {
      const f = await file(key);
      const p = await fs();
      await p.mkdir((await path()).dirname(f), { recursive: true });
      await p.writeFile(f, bytes);
      await p.writeFile(`${f}.type`, contentType);
    },
    async read(key) {
      const f = await file(key);
      const p = await fs();
      try {
        return { bytes: new Uint8Array(await p.readFile(f)), contentType: await p.readFile(`${f}.type`, 'utf8') };
      } catch {
        return null;
      }
    },
    async remove(key) {
      const f = await file(key);
      const p = await fs();
      await p.rm(f, { force: true });
      await p.rm(`${f}.type`, { force: true });
    },
  };
}
