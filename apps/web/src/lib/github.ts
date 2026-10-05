// Contenido del repo para la web (README y árbol de archivos) anclado al SHA del manifiesto: como un SHA nunca
// cambia, la caché es inmutable. Solo se habla con api.github.com, raw.githubusercontent.com y gitlab.com (V03-03).
import { createFileFilter, relativeToInclude } from '@genpm/manifest';

const UA = { 'user-agent': 'genpm-web', accept: 'application/vnd.github+json' };
const IMMUTABLE = 'public, max-age=31536000, immutable';

type Coords = { host: 'github'; owner: string; name: string } | { host: 'gitlab'; path: string };

function coords(repo: string): Coords | null {
  const gh = repo.match(/^https:\/\/github\.com\/([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)$/);
  if (gh) return { host: 'github', owner: gh[1]!, name: gh[2]! };
  const gl = repo.match(/^https:\/\/gitlab\.com\/((?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.-]+)$/);
  if (gl && !gl[1]!.split('/').some((s) => s === '.' || s === '..')) return { host: 'gitlab', path: gl[1]! };
  return null;
}

const enc = (path: string) => path.split('/').map(encodeURIComponent).join('/');

/** Bases para enlaces (`blob`) e imágenes (`raw`) relativas de un README en `i`, ancladas al commit. */
export function sourceLinks(repo: string, sha: string, include: string): { blobBase: string; rawBase: string } {
  const c = coords(repo);
  const dir = include === '.' ? '' : `${include}/`;
  if (!c) return { blobBase: '', rawBase: '' };
  if (c.host === 'gitlab')
    return {
      blobBase: `https://gitlab.com/${c.path}/-/blob/${sha}/${dir}`,
      rawBase: `https://gitlab.com/${c.path}/-/raw/${sha}/${dir}`,
    };
  return {
    blobBase: `https://github.com/${c.owner}/${c.name}/blob/${sha}/${dir}`,
    rawBase: `https://raw.githubusercontent.com/${c.owner}/${c.name}/${sha}/${dir}`,
  };
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

/** Archivo de texto en un commit. `undefined` = el host no responde; `null` = no existe. */
export async function rawFile(
  repo: string,
  sha: string,
  path: string,
  maxBytes = 512 * 1024,
): Promise<string | null | undefined> {
  const c = coords(repo);
  if (!c || !/^[0-9a-f]{40}$/.test(sha)) return null;
  const res = await cachedFetch(
    c.host === 'gitlab'
      ? `https://gitlab.com/api/v4/projects/${encodeURIComponent(c.path)}/repository/files/${encodeURIComponent(path)}/raw?ref=${sha}`
      : `https://raw.githubusercontent.com/${c.owner}/${c.name}/${sha}/${enc(path)}`,
  );
  if (!res) return undefined;
  if (res.status === 404) return null;
  const text = await res.text();
  return text.length > maxBytes ? `${text.slice(0, maxBytes)}\n…` : text;
}

export type TreeFile = { path: string; size: number };

/** Blobs del árbol del commit; `null` = no existe, `undefined` = el host no responde. */
async function githubTree(owner: string, name: string, sha: string): Promise<TreeFile[] | null | undefined> {
  const res = await cachedFetch(`https://api.github.com/repos/${owner}/${name}/git/trees/${sha}?recursive=1`, {
    headers: UA,
  });
  if (!res || res.status === 404) return res ? null : undefined;
  const tree = (await res.json()) as { tree: Array<{ path: string; type: string; size?: number }> };
  return tree.tree.filter((e) => e.type === 'blob').map((e) => ({ path: e.path, size: e.size ?? 0 }));
}

/** GitLab pagina el árbol (100 por página) y no da tamaños: se muestran como 0. Máximo 20 páginas. */
async function gitlabTree(path: string, sha: string): Promise<TreeFile[] | null | undefined> {
  const out: TreeFile[] = [];
  for (let page = 1; page <= 20; page++) {
    const res = await cachedFetch(
      `https://gitlab.com/api/v4/projects/${encodeURIComponent(path)}/repository/tree?ref=${sha}&recursive=true&per_page=100&page=${page}`,
      { headers: { 'user-agent': 'genpm-web', accept: 'application/json' } },
    );
    if (!res || res.status === 404) return res ? (page === 1 ? null : out) : undefined;
    const rows = (await res.json()) as Array<{ path: string; type: string }>;
    for (const e of rows) if (e.type === 'blob') out.push({ path: e.path, size: 0 });
    if (rows.length < 100) break;
  }
  return out;
}

/** Árbol exacto que se inyectaría: bajo `i`, filtrado por exclusiones duras y `.genpmignore`. */
export async function injectedTree(repo: string, sha: string, include: string): Promise<TreeFile[] | undefined> {
  const c = coords(repo);
  if (!c) return [];
  const blobs = c.host === 'gitlab' ? await gitlabTree(c.path, sha) : await githubTree(c.owner, c.name, sha);
  if (!blobs) return blobs === null ? [] : undefined;
  const ignore = await rawFile(repo, sha, include === '.' ? '.genpmignore' : `${include}/.genpmignore`);
  const included = createFileFilter(typeof ignore === 'string' ? ignore : null);
  const out: TreeFile[] = [];
  for (const e of blobs) {
    const rel = relativeToInclude(include, e.path);
    if (rel !== null && included(rel)) out.push({ path: rel, size: e.size ?? 0 });
  }
  return out.sort((a, b) => a.path.localeCompare(b.path));
}
