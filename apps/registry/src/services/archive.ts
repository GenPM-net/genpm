// Verified Archive (V03-02, ADR-007): copia en R2 del tar.gz del commit publicado. Si el repo desaparece o GitHub no
// responde, el CLI puede instalar desde aquí: verifica la firma del registry sobre {n, v, c, sha256} y el sha256.
import { archiveRecord, sha256Hex } from '@genpm/manifest';
import type { Env } from '../env.js';
import { sign } from './signing.js';

/** Límite de una copia (el registry ya limita el paquete descomprimido; esto acota el comprimido). */
const MAX_BYTES = 50 * 1024 * 1024;

export function archiveKey(name: string, version: string, sha: string): string {
  return `v1/${name.slice(1)}/${version}-${sha}.tar.gz`;
}

export async function archiveVersion(
  env: Env,
  a: { verId: string; n: string; v: string; c: string; gz: Uint8Array },
): Promise<boolean> {
  if (!env.ARCHIVE || a.gz.byteLength > MAX_BYTES) return false;
  const h = await sha256Hex(a.gz);
  await env.ARCHIVE.put(archiveKey(a.n, a.v, a.c), a.gz, {
    httpMetadata: { contentType: 'application/gzip' },
    customMetadata: { sha256: h, commit: a.c },
  });
  const sig = await sign(env, archiveRecord({ n: a.n, v: a.v, c: a.c, h }));
  await env.DB.prepare(
    'UPDATE package_versions SET archive_sha256 = ?1, archive_size = ?2, archive_sig = ?3 WHERE id = ?4',
  )
    .bind(h, a.gz.byteLength, sig, a.verId)
    .run();
  return true;
}
