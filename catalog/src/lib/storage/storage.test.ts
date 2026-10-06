import { afterEach, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { localStorageRoutes } from './adapters/hono.js';
import {
  assertSafeKey,
  backendStorage,
  diskBackend,
  generateKey,
  getStorage,
  handleLocalDownload,
  handleLocalUpload,
  memoryBackend,
  s3Storage,
  setStorage,
  StorageError,
  storageFromEnv,
} from './index.js';

const SECRET = 'k'.repeat(40);
const text = (s: string) => new TextEncoder().encode(s);

describe('keys', () => {
  it('rejects traversal and odd keys', () => {
    for (const bad of ['../x', 'a/../b', '/abs', 'a//b', 'a/.', 'a/..', 'é/x', `${'a/'.repeat(11)}b`, 'a b'])
      expect(() => assertSafeKey(bad), bad).toThrow(StorageError);
    expect(assertSafeKey('public/media/2026/a.jpg')).toBe('public/media/2026/a.jpg');
  });
  it('generates random keys and keeps only a safe extension', () => {
    const k = generateKey('public/media/', '../../evil name.JPG');
    expect(k).toMatch(/^public\/media\/[0-9a-f]{32}\.jpg$/);
    expect(generateKey('uploads', 'noext')).toMatch(/^uploads\/[0-9a-f]{32}$/);
    expect(generateKey('uploads', 'x.p h p')).toMatch(/^uploads\/[0-9a-f]{32}$/);
  });
});

describe('memory/local driver with signed uploads', () => {
  const make = () => backendStorage('memory', memoryBackend(), { secret: SECRET, baseUrl: 'http://app.test' });

  it('uploads with a signed URL, then downloads privately', async () => {
    const s = make();
    const up = await s.presignUpload('private/a.txt', { contentType: 'text/plain', size: 5, maxBytes: 10 });
    expect(up.url).toMatch(/^http:\/\/app\.test\/api\/storage\?token=/);
    const put = await handleLocalUpload(new Request(up.url, { method: 'PUT', headers: up.headers, body: 'hello' }), s, SECRET);
    expect(put.status).toBe(200);
    expect(await s.head('private/a.txt')).toEqual({ key: 'private/a.txt', size: 5, contentType: 'text/plain' });
    const dl = await handleLocalDownload(new Request(await s.presignDownload('private/a.txt')), s, SECRET);
    expect(await dl.text()).toBe('hello');
    expect(dl.headers.get('content-security-policy')).toContain('sandbox');
  });

  it('rejects oversize declarations, size or type mismatch and tampered or reused tokens', async () => {
    const s = make();
    await expect(s.presignUpload('a/b', { contentType: 'text/plain', size: 11, maxBytes: 10 })).rejects.toThrow(/exceeds/);
    const up = await s.presignUpload('a/b.txt', { contentType: 'text/plain', size: 3, maxBytes: 10 });
    const put = (url: string, body: string, type = 'text/plain') =>
      handleLocalUpload(new Request(url, { method: 'PUT', headers: { 'content-type': type }, body }), s, SECRET);
    expect((await put(up.url, 'toolong')).status).toBe(400);
    expect((await put(up.url, 'abc', 'text/html')).status).toBe(400);
    expect((await put(`${up.url}x`, 'abc')).status).toBe(403);
    const dl = await s.presignDownload('a/b.txt');
    expect((await put(dl, 'abc')).status).toBe(403); // token de descarga no sirve para subir
    expect((await put(up.url, 'abc')).status).toBe(200);
  });

  it('serves only public/ keys without a token', async () => {
    const s = make();
    await s.put('public/x.txt', 'pub', { contentType: 'text/plain' });
    await s.put('private/y.txt', 'priv', { contentType: 'text/plain' });
    expect(s.publicUrl('public/x.txt')).toBe('http://app.test/api/storage/public/x.txt');
    expect(() => s.publicUrl('private/y.txt')).toThrow(/not a public key/);
    const get = (p: string) => handleLocalDownload(new Request(`http://app.test/api/storage/${p}`), s, SECRET);
    expect(await (await get('public/x.txt')).text()).toBe('pub');
    expect((await get('private/y.txt')).status).toBe(404);
    expect((await get('public/..%2Fprivate/y.txt')).status).toBe(404);
  });

  it('expired tokens are rejected', async () => {
    const s = make();
    const url = await s.presignDownload('a/b', -1);
    expect((await handleLocalDownload(new Request(url), s, SECRET)).status).toBe(403);
  });

  it('Hono routes wire the same handlers', async () => {
    const s = make();
    setStorage(s);
    const app = new Hono().route('/api/storage', localStorageRoutes(SECRET));
    const up = await s.presignUpload('public/h.txt', { contentType: 'text/plain', size: 2, maxBytes: 10 });
    const path = up.url.replace('http://app.test', '');
    expect((await app.request(path, { method: 'PUT', headers: up.headers, body: 'hi' })).status).toBe(200);
    expect(await (await app.request('/api/storage/public/h.txt')).text()).toBe('hi');
    expect(getStorage()).toBe(s);
  });
});

describe('disk backend', () => {
  let dir = '';
  afterEach(async () => dir && rm(dir, { recursive: true, force: true }));
  it('writes, reads and deletes files', async () => {
    dir = await mkdtemp(join(tmpdir(), 'storage-'));
    const s = backendStorage('local', diskBackend(dir), { secret: SECRET, baseUrl: 'http://app.test' });
    await s.put('public/d/f.bin', text('xyz'), { contentType: 'application/octet-stream' });
    const o = await s.get('public/d/f.bin');
    expect(o?.size).toBe(3);
    expect(await new Response(o!.body).text()).toBe('xyz');
    await s.delete('public/d/f.bin');
    expect(await s.get('public/d/f.bin')).toBeNull();
  });
});

describe('S3 driver', () => {
  const calls: Request[] = [];
  const fakeFetch = (async (input: RequestInfo | URL) => {
    const req = input as Request;
    calls.push(req);
    if (req.method === 'GET' && req.url.endsWith('/missing')) return new Response(null, { status: 404 });
    if (req.method === 'GET') return new Response('data', { headers: { 'content-type': 'text/plain', 'content-length': '4' } });
    return new Response(null, { status: 200 });
  }) as typeof fetch;
  const s3 = s3Storage({
    endpoint: 'https://acc.r2.cloudflarestorage.com/',
    bucket: 'site',
    accessKeyId: 'AKID',
    secretAccessKey: 'SECRET',
    publicUrl: 'https://cdn.example.com',
    fetch: fakeFetch,
  });

  it('signs object requests with SigV4 against path-style URLs', async () => {
    await s3.put('public/a_b.txt', 'hi', { contentType: 'text/plain', cacheControl: 'max-age=60' });
    const put = calls.at(-1)!;
    expect(put.url).toBe('https://acc.r2.cloudflarestorage.com/site/public/a_b.txt');
    expect(put.headers.get('authorization')).toMatch(/^AWS4-HMAC-SHA256 Credential=AKID\/\d{8}\/auto\/s3\/aws4_request/);
    expect(put.headers.get('x-amz-date')).toMatch(/^\d{8}T\d{6}Z$/);
    const got = await s3.get('public/a_b.txt');
    expect(await new Response(got!.body).text()).toBe('data');
    expect(await s3.get('missing')).toBeNull();
  });

  it('presigned uploads sign content-type and content-length with an expiry', async () => {
    const up = await s3.presignUpload('uploads/x.png', { contentType: 'image/png', size: 1234, maxBytes: 5_000_000, expiresIn: 120 });
    const u = new URL(up.url);
    expect(u.searchParams.get('X-Amz-Expires')).toBe('120');
    expect(u.searchParams.get('X-Amz-SignedHeaders')).toBe('content-length;content-type;host');
    expect(u.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
    expect(up.headers).toEqual({ 'content-type': 'image/png' });
    await expect(s3.presignUpload('uploads/x.png', { contentType: 'image/png', size: 0, maxBytes: 10 })).rejects.toThrow();
  });

  it('public URLs only for public/ keys', () => {
    expect(s3.publicUrl('public/a.png')).toBe('https://cdn.example.com/public/a.png');
    expect(() => s3.publicUrl('private/a.png')).toThrow(StorageError);
    expect(() => s3.publicUrl('public/../a')).toThrow(StorageError);
  });
});

describe('storageFromEnv', () => {
  it('builds each driver and reports missing variables', () => {
    expect(() => storageFromEnv({})).toThrow(/STORAGE_ENDPOINT/);
    expect(storageFromEnv({ STORAGE_DRIVER: 'memory', STORAGE_SECRET: SECRET, STORAGE_PUBLIC_URL: 'http://x' }).driver).toBe('memory');
    expect(() => storageFromEnv({ STORAGE_DRIVER: 'memory', STORAGE_SECRET: 'short', STORAGE_PUBLIC_URL: 'http://x' })).toThrow(/32/);
    expect(() => storageFromEnv({ STORAGE_DRIVER: 'ftp' })).toThrow(/unknown/);
  });
});
