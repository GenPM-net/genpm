// `.genpmrc` (manifest-spec §6.1): formato INI estilo npm, sin secretos. Precedencia (cli-mcp-spec §A.2):
// flags > env > `.genpmrc` del proyecto > `~/.genpmrc` > defaults.

import { homedir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_REGISTRY } from '@genpm/manifest';
import { readTextOrNull } from './fs/io.js';

export type Rc = {
  registry?: string;
  scopes: Record<string, string>;
  clients?: string[];
  lang?: string;
  /** ENT-03: registro cuya política de organización se aplica a todo lo que se instala en este proyecto. */
  policy?: string;
};

export function parseRc(text: string): Rc {
  const rc: Rc = { scopes: {} };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    const scoped = key.match(/^@([a-z0-9][a-z0-9-]*):registry$/);
    if (scoped) rc.scopes[scoped[1]!] = value;
    else if (key === 'registry') rc.registry = value;
    else if (key === 'clients')
      rc.clients = value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    else if (key === 'lang') rc.lang = value;
    else if (key === 'policy') rc.policy = value;
  }
  return rc;
}

export function mergeRc(...layers: Rc[]): Rc {
  const out: Rc = { scopes: {} };
  for (const l of layers) {
    if (l.registry) out.registry = l.registry;
    if (l.clients) out.clients = l.clients;
    if (l.lang) out.lang = l.lang;
    if (l.policy) out.policy = l.policy;
    Object.assign(out.scopes, l.scopes);
  }
  return out;
}

export async function loadRc(root: string | null, home = homedir()): Promise<Rc> {
  const user = await readTextOrNull(join(home, '.genpmrc'));
  const project = root ? await readTextOrNull(join(root, '.genpmrc')) : null;
  return mergeRc(parseRc(user ?? ''), parseRc(project ?? ''));
}

/** Registry para un paquete: `--registry`/`GENPM_REGISTRY` > `@scope:registry` > `registry=` > default. */
export function registryFor(name: string | null, rc: Rc, override?: string): string {
  if (override) return override.replace(/\/+$/, '');
  const scope = name?.match(/^@([^/]+)\//)?.[1];
  const url = (scope && rc.scopes[scope]) || rc.registry || DEFAULT_REGISTRY;
  return url.replace(/\/+$/, '');
}
