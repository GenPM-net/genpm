// Contenido de GitHub para la web (README y árbol de archivos) anclado al SHA del manifiesto: como un SHA nunca
// cambia, la caché es inmutable. Solo se habla con api.github.com y raw.githubusercontent.com (CSP/SSRF).
import { createFileFilter, relativeToInclude } from '@genpm/manifest';

const UA = { 'user-agent': 'genpm-web', accept: 'application/vnd.github+json' };
const IMMUTABLE = 'public, max-age=31536000, immutable';

function coords(repo: string): { owner: string; name: string } | null {
  const m = repo.match(/^https:\/\/github\.com\/([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)$/);
  return m ? { owner: m[1]!, name: m[2]! } : null;
}

async function cachedFetch(url: string, init: RequestInit = {}): Promise<Response | null> {
  const cache = typeof caches !== 'undefined' ? (caches as unknown as { default: Cache }).default : null;
  const key = new Request(url);
  const hit = cache ? await cache.match(key) : undefined;
  if (hit) return hit;
  try {
    const res = await fetch(url, { ...init, redirect: 'manual' });
    if (!res.ok) return res.status === 404 ? new Response(null, { status: 404 }) : null;
    const body = await res.arrayBuffer();
    const copy = new Response(body, {
      headers: { 'content-type': res.headers.get('content-type') ?? 'text/plain', 'cache-control': IMMUTABLE },
    });
    if (cache) await cache.put(key, copy.clone()).catch(() => undefined);
    return copy;
  } catch {
    return null;
  }
}

/** Archivo de texto en un commit. `undefined` = GitHub no responde; `null` = no existe. */
export async function rawFile(
  repo: string,
  sha: string,
  path: string,
  maxBytes = 512 * 1024,
): Promise<string | null | undefined> {
  const c = coords(repo);
  if (!c || !/^[0-9a-f]{40}$/.test(sha)) return null;
  const res = await cachedFetch(
    `https://raw.githubusercontent.com/${c.owner}/${c.name}/${sha}/${path.split('/').map(encodeURIComponent).join('/')}`,
  );
  if (!res) return undefined;
  if (res.status === 404) return null;
  const text = await res.text();
  return text.length > maxBytes ? `${text.slice(0, maxBytes)}\n…` : text;
}

export type TreeFile = { path: string; size: number };

/** Árbol exacto que se inyectaría: bajo `i`, filtrado por exclusiones duras y `.genpmignore`. */
export async function injectedTree(repo: string, sha: string, include: string): Promise<TreeFile[] | undefined> {
  const c = coords(repo);
  if (!c) return [];
  const res = await cachedFetch(`https://api.github.com/repos/${c.owner}/${c.name}/git/trees/${sha}?recursive=1`, {
    headers: UA,
  });
  if (!res || res.status === 404) return res ? [] : undefined;
  const tree = (await res.json()) as { tree: Array<{ path: string; type: string; size?: number }> };
  const ignore = await rawFile(repo, sha, include === '.' ? '.genpmignore' : `${include}/.genpmignore`);
  const included = createFileFilter(typeof ignore === 'string' ? ignore : null);
  const out: TreeFile[] = [];
  for (const e of tree.tree) {
    if (e.type !== 'blob') continue;
    const rel = relativeToInclude(include, e.path);
    if (rel !== null && included(rel)) out.push({ path: rel, size: e.size ?? 0 });
  }
  return out.sort((a, b) => a.path.localeCompare(b.path));
}
