// Driver S3 compatible (Cloudflare R2, AWS S3, MinIO, Backblaze B2) con firma SigV4 de aws4fetch. Funciona en Node y Workers.
import { AwsClient, AwsV4Signer } from 'aws4fetch';
import { assertSafeKey, isPublicKey, StorageError } from './keys.ts';
import { type PresignUploadOptions, type PutBody, type PutOptions, type StorageProvider, toBytes } from './provider.ts';

export type S3Config = {
  endpoint: string;
  bucket: string;
  region?: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Base pública (CDN o dominio del bucket) para claves `public/`. */
  publicUrl?: string;
  /** Inyectable para tests. */
  fetch?: typeof fetch;
};

const encodeKey = (key: string) => key.split('/').map(encodeURIComponent).join('/');

export function s3Storage(cfg: S3Config): StorageProvider {
  const region = cfg.region ?? 'auto';
  const client = new AwsClient({ accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey, service: 's3', region });
  const doFetch = cfg.fetch ?? fetch;
  const objectUrl = (key: string) => `${cfg.endpoint.replace(/\/+$/, '')}/${cfg.bucket}/${encodeKey(assertSafeKey(key))}`;

  const send = async (key: string, init: RequestInit) => {
    const signed = await client.sign(objectUrl(key), init);
    return doFetch(signed);
  };

  const presign = async (key: string, method: 'GET' | 'PUT', expiresIn: number, headers: Record<string, string> = {}) => {
    const url = new URL(objectUrl(key));
    url.searchParams.set('X-Amz-Expires', String(Math.min(Math.max(1, Math.floor(expiresIn)), 604_800)));
    const signer = new AwsV4Signer({
      url: url.toString(),
      method,
      headers,
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
      service: 's3',
      region,
      signQuery: true,
      // Firma también content-type y content-length: el navegador no puede subir otro tipo ni otro tamaño.
      allHeaders: true,
    });
    return (await signer.sign()).url.toString();
  };

  const info = (key: string, res: Response) => ({
    key,
    size: Number(res.headers.get('content-length') ?? 0),
    contentType: res.headers.get('content-type') ?? 'application/octet-stream',
  });

  return {
    driver: 's3',
    async put(key: string, body: PutBody, opts: PutOptions) {
      const bytes = await toBytes(body);
      const headers: Record<string, string> = { 'content-type': opts.contentType };
      if (opts.cacheControl) headers['cache-control'] = opts.cacheControl;
      const res = await send(key, { method: 'PUT', body: bytes as Uint8Array<ArrayBuffer>, headers });
      if (!res.ok) throw new StorageError('upstream', `S3 PUT ${res.status}`);
      return { key, size: bytes.byteLength, contentType: opts.contentType };
    },
    async get(key) {
      const res = await send(key, { method: 'GET' });
      if (res.status === 404) return null;
      if (!res.ok || !res.body) throw new StorageError('upstream', `S3 GET ${res.status}`);
      return { ...info(key, res), body: res.body };
    },
    async head(key) {
      const res = await send(key, { method: 'HEAD' });
      if (res.status === 404) return null;
      if (!res.ok) throw new StorageError('upstream', `S3 HEAD ${res.status}`);
      return info(key, res);
    },
    async delete(key) {
      const res = await send(key, { method: 'DELETE' });
      if (!res.ok && res.status !== 404) throw new StorageError('upstream', `S3 DELETE ${res.status}`);
    },
    async presignUpload(key: string, opts: PresignUploadOptions) {
      checkSize(opts);
      const expiresIn = opts.expiresIn ?? 600;
      const headers = { 'content-type': opts.contentType, 'content-length': String(opts.size) };
      const url = await presign(key, 'PUT', expiresIn, headers);
      // content-length lo pone el navegador; solo hace falta enviar content-type.
      return { url, method: 'PUT', headers: { 'content-type': opts.contentType }, expiresAt: new Date(Date.now() + expiresIn * 1000) };
    },
    presignDownload: (key, expiresIn = 300) => presign(key, 'GET', expiresIn),
    publicUrl(key) {
      assertSafeKey(key);
      if (!isPublicKey(key) || !cfg.publicUrl) throw new StorageError('not_public', `not a public key: ${key}`);
      return `${cfg.publicUrl.replace(/\/+$/, '')}/${encodeKey(key)}`;
    },
  };
}

export function checkSize(opts: PresignUploadOptions): void {
  if (!Number.isInteger(opts.size) || opts.size <= 0 || opts.size > opts.maxBytes)
    throw new StorageError('too_large', `size ${opts.size} exceeds ${opts.maxBytes} bytes`);
}
