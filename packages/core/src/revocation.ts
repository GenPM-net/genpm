// Revocación de claves de firma (security §4.3, INV-8). El registry publica en GET /v1/keys una lista firmada por la
// clave raíz offline; el cliente solo la acepta si esa firma es válida y la guarda en caché de forma MONÓTONA:
// nunca se "des-revoca" una clave, así que un registry comprometido no puede borrar una revocación omitiendo la lista
// o sirviendo una más antigua.

import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { type RevocationList, verifyRevocationList } from '@genpm/manifest';
import { effectiveCacheDir } from './fetch/index.js';
import { readTextOrNull, writeFileAtomic } from './fs/io.js';
import { ROOT_PUBLIC_KEY } from './keys.js';

export type RevocationSource = { keys(): Promise<{ revocation: unknown }> };

export type RevocationOptions = {
  registry: string;
  client: RevocationSource;
  cacheDir?: string;
  /** Clave raíz (base64url). Por defecto `GENPM_ROOT_PUBLIC_KEY` o la fijada en keys.ts. */
  rootKey?: string | null;
  env?: Record<string, string | undefined>;
};

const isList = (x: unknown): x is RevocationList => {
  const l = x as RevocationList | null;
  return (
    !!l &&
    l.v === 1 &&
    typeof l.issuedAt === 'number' &&
    Array.isArray(l.revoked) &&
    l.revoked.every((k) => typeof k === 'string') &&
    typeof l.sig === 'string'
  );
};

async function valid(x: unknown, root: string): Promise<RevocationList | null> {
  if (!isList(x)) return null;
  try {
    return (await verifyRevocationList(x, root)) ? x : null;
  } catch {
    return null;
  }
}

const cacheFile = (dir: string, registry: string) =>
  join(dir, 'revocation', `${createHash('sha256').update(registry).digest('hex').slice(0, 16)}.json`);

/**
 * Claves revocadas para un registry. Sin clave raíz configurada no hay revocación posible (lista vacía).
 * Se guardan todas las listas válidas vistas (firmadas, no se pueden fusionar) y el resultado es su unión: un fallo de
 * red, una lista inválida o una lista más antigua nunca reducen el conjunto de claves revocadas.
 */
export async function revokedKeys(opts: RevocationOptions): Promise<string[]> {
  const env = opts.env ?? process.env;
  const root = opts.rootKey !== undefined ? opts.rootKey : (env['GENPM_ROOT_PUBLIC_KEY'] ?? ROOT_PUBLIC_KEY);
  if (!root) return [];
  const file = cacheFile(effectiveCacheDir(opts.cacheDir), opts.registry);
  const known: RevocationList[] = [];
  try {
    const saved = JSON.parse((await readTextOrNull(file)) ?? '[]') as unknown;
    for (const x of Array.isArray(saved) ? saved : []) {
      const l = await valid(x, root);
      if (l) known.push(l);
    }
  } catch {
    // Caché corrupta: se reconstruye con la lista remota.
  }
  let remote: RevocationList | null = null;
  try {
    remote = await valid((await opts.client.keys()).revocation, root);
  } catch {
    remote = null;
  }
  if (remote && !known.some((l) => l.sig === remote.sig)) {
    known.push(remote);
    await writeFileAtomic(file, JSON.stringify(known));
  }
  return [...new Set(known.flatMap((l) => l.revoked))].sort();
}
