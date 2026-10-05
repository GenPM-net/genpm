// GET /v1/archive/:scope/:name/:version (V03-02): tar.gz del commit publicado, desde R2. Cabeceras con el sha256 y la
// firma del registry sobre {n, v, c, h}; inmutable. 404 si esa versión no tiene copia; 451 en cuarentena.
import { signatureHeader } from '@genpm/manifest';
import { Hono } from 'hono';
import type { AppEnv } from '../env.js';
import { httpError } from '../http.js';
import { archiveKey } from '../services/archive.js';
import { fullName, repoOf } from './util.js';

export const archive = new Hono<AppEnv>().get(
  '/:scope{@[a-z0-9][a-z0-9-]*}/:name{[a-z0-9][a-z0-9-]*}/:version{[0-9A-Za-z.+-]+}',
  async (c) => {
    const repo = repoOf(c);
    const name = fullName(c);
    const pkg = await repo.packageByName(name);
    if (!pkg) throw httpError('E_NOT_FOUND', { name });
    const v = await repo.version(pkg.id, c.req.param('version'));
    if (!v) throw httpError('E_NO_MATCHING_VERSION', { name, range: c.req.param('version') });
    if (v.status === 'quarantined' || v.scan_status === 'flagged')
      throw httpError('E_QUARANTINED', { name: `${name}@${v.version}` });
    const row = v;
    if (!c.env.ARCHIVE || !row.archive_sha256 || !row.archive_sig)
      throw httpError('E_NOT_FOUND', { name: `${name}@${v.version} archive` });
    const obj = await c.env.ARCHIVE.get(archiveKey(name, v.version, v.commit_sha));
    if (!obj) throw httpError('E_NOT_FOUND', { name: `${name}@${v.version} archive` });
    return new Response(obj.body, {
      headers: {
        'content-type': 'application/gzip',
        'cache-control': 'public, max-age=31536000, immutable',
        'genpm-commit': v.commit_sha,
        'genpm-archive-sha256': row.archive_sha256,
        'genpm-archive-signature': signatureHeader(row.archive_sig),
      },
    });
  },
);
