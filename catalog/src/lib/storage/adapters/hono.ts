// Adaptador Hono (solo drivers `local`/`memory`): `app.route('/api/storage', localStorageRoutes())`.
import { Hono } from 'hono';
import { getStorage, handleLocalDownload, handleLocalUpload } from '../index.ts';

export function localStorageRoutes(secret = process.env.STORAGE_SECRET ?? '', routePath = '/api/storage') {
  return new Hono()
    .put('/', (c) => handleLocalUpload(c.req.raw, getStorage(), secret))
    .get('/*', (c) => handleLocalDownload(c.req.raw, getStorage(), secret, routePath));
}
