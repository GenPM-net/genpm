// core/fetch (architecture §7.1): caché inmutable por SHA → git por SHA (sparse + partial clone) → tarball.
// INV-1: tras el fetch se verifica `rev-parse HEAD === c` y el hash git de CADA archivo contra el árbol del commit,
// de modo que ningún filtro, conversión de fin de línea o servidor malicioso puede alterar los bytes inyectados.

import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { checkRelativePath, gunzip, readTar, relativeToInclude, SHA_RE, tarGlobalComment } from '@genpm/manifest';
import { fail } from '../errors.js';
import { exists } from '../fs/io.js';
import { type GitOptions, gitAtLeast, gitVersion, runGit } from './git.js';

export type TreeEntry = {
  path: string;
  mode: number;
  type: 'file' | 'symlink' | 'submodule';
  size: number;
  sha1: string | null;
};

export type FetchedSource = {
  /** Directorio con el árbol del commit (rutas relativas a la raíz del repo). */
  dir: string;
  /** Entradas bajo `i`, con rutas relativas a `i`. */
  entries: TreeEntry[];
  c: string;
  via: 'cache' | 'git' | 'tarball' | 'archive';
};

export type FetchOptions = GitOptions & {
  cacheDir?: string;
  /**
   * Último recurso (Verified Archive, V03-02): tar.gz del commit ya verificado por el llamador (firma del registry y
   * sha256). Se usa solo si Git y codeload fallan por red o por un repo que ya no existe.
   */
  mirror?: () => Promise<Uint8Array | null>;
  /** Forzar una estrategia (tests). */
  strategy?: 'auto' | 'git' | 'tarball';
  fetchImpl?: typeof fetch;
};

const TREE_FILE = '.genpm-tree.json';

/**
 * Opciones por defecto SOLO para tests en proceso (CLI y MCP los usan para repos fixture `file://`).
 * No hay flag ni variable de entorno que las active: solo código que importe @genpm/core explícitamente.
 */
let testDefaults: FetchOptions = {};
export function __setFetchTestDefaults(opts: FetchOptions): void {
  testDefaults = opts;
}

export function defaultCacheDir(): string {
  return process.env['GENPM_CACHE_DIR'] ?? join(homedir(), '.genpm', 'cache');
}

/** Directorio de caché efectivo (opción explícita > defaults de test > GENPM_CACHE_DIR/~/.genpm/cache). */
export function effectiveCacheDir(explicit?: string): string {
  return explicit ?? testDefaults.cacheDir ?? defaultCacheDir();
}

/** `https://github.com/genpm-net/auth` → `github.com/genpm-net/auth`; `file:///x/y` → `local/<hash>`. */
export function repoCacheKey(r: string): string {
  const u = new URL(r);
  if (u.protocol === 'file:') return `local/${createHash('sha256').update(u.pathname).digest('hex').slice(0, 16)}`;
  const path = u.pathname.replace(/^\/+|\/+$/g, '').replace(/\.git$/, '');
  return `${u.hostname}/${path
    .split('/')
    .map((s) => s.replace(/[^A-Za-z0-9._-]/g, '_'))
    .join('/')}`;
}

function cachePath(cacheDir: string, r: string, c: string, i: string): string {
  const suffix = i === '.' ? '' : `~${createHash('sha256').update(i).digest('hex').slice(0, 12)}`;
  return join(cacheDir, repoCacheKey(r), `${c}${suffix}`);
}

export function gitBlobSha1(data: Uint8Array): string {
  return createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex');
}

/** Hash git de un archivo (sha1 o sha256 según la longitud del SHA del árbol). */
function gitBlobHash(data: Uint8Array, len: number): string {
  return createHash(len === 64 ? 'sha256' : 'sha1')
    .update(`blob ${data.length}\0`)
    .update(data)
    .digest('hex');
}

function parseLsTree(out: Buffer): Array<{ mode: number; type: string; sha: string; size: number; path: string }> {
  const rows = [];
  for (const rec of out.toString('utf8').split('\0')) {
    if (!rec) continue;
    // <mode> SP <type> SP <object> SP+ <size> TAB <path>   (con --long)
    const m = rec.match(/^(\d{6}) (\w+) ([0-9a-f]{40,64})\s+(-|\d+)\t([\s\S]+)$/);
    if (m)
      rows.push({
        mode: Number.parseInt(m[1]!, 8),
        type: m[2]!,
        sha: m[3]!,
        size: m[4] === '-' ? 0 : Number(m[4]),
        path: m[5]!,
      });
  }
  return rows;
}

async function viaGit(tmp: string, r: string, c: string, i: string, opts: FetchOptions): Promise<TreeEntry[]> {
  const g = (args: string[]) => runGit(args, { ...opts, cwd: tmp });
  await g(['init', '-q']);
  // INV-2: `$GIT_DIR/info/attributes` tiene la máxima precedencia y anula cualquier `.gitattributes` del paquete:
  // sin filtros (smudge/process, incluido LFS), sin conversión de fin de línea, sin ident ni re-encoding.
  await mkdir(join(tmp, '.git', 'info'), { recursive: true });
  await writeFile(
    join(tmp, '.git', 'info', 'attributes'),
    '* -filter -text -eol -crlf -ident -working-tree-encoding\n',
  );
  await g(['remote', 'add', 'origin', r]);
  const sparse = i !== '.';
  if (sparse) {
    await g(['sparse-checkout', 'set', '--no-cone', `/${i}/`]);
  }
  await g(['fetch', '-q', '--no-tags', '--depth', '1', ...(sparse ? ['--filter=blob:none'] : []), 'origin', c]);
  // INV-3 antes de tocar el disco: un nombre inseguro (reservado de Windows, NFD, punto final…) se rechaza aquí con
  // E_PATH_UNSAFE en todas las plataformas, en vez de dejar que el checkout falle (Windows) o lo escriba (macOS/Linux).
  const names = (
    await g(['ls-tree', '-r', '-z', '--name-only', '--full-tree', 'FETCH_HEAD', ...(sparse ? ['--', i] : [])])
  ).stdout
    .toString('utf8')
    .split('\0')
    .filter(Boolean);
  for (const name of names) {
    const problem = checkRelativePath(name);
    if (problem) throw fail('E_PATH_UNSAFE', { path: name, reason: problem });
  }
  await g(['checkout', '-q', '--detach', 'FETCH_HEAD']);
  const head = (await g(['rev-parse', 'HEAD'])).stdout.toString().trim();
  if (head !== c) throw fail('E_INTEGRITY', { name: r, detail: `HEAD ${head.slice(0, 12)} != ${c.slice(0, 12)}` });
  const tree = parseLsTree(
    (await g(['ls-tree', '-r', '-z', '--long', '--full-tree', 'HEAD', ...(sparse ? ['--', i] : [])])).stdout,
  );
  const entries: TreeEntry[] = [];
  for (const row of tree) {
    const rel = relativeToInclude(i, row.path);
    if (rel === null) continue;
    if (row.type === 'commit' || row.mode === 0o160000) {
      entries.push({ path: rel, mode: row.mode, type: 'submodule', size: 0, sha1: null });
      continue;
    }
    if (row.mode === 0o120000) {
      entries.push({ path: rel, mode: row.mode, type: 'symlink', size: row.size, sha1: row.sha });
      continue;
    }
    // INV-1: los bytes en disco deben coincidir con el blob del árbol del commit.
    const data = await readFile(join(tmp, ...row.path.split('/')));
    if (gitBlobHash(data, row.sha.length) !== row.sha) {
      throw fail('E_INTEGRITY', { name: r, detail: `${row.path} does not match the commit tree` });
    }
    entries.push({ path: rel, mode: row.mode, type: 'file', size: data.length, sha1: row.sha });
  }
  await rm(join(tmp, '.git'), { recursive: true, force: true });
  return entries;
}

async function viaTarball(tmp: string, r: string, c: string, i: string, opts: FetchOptions): Promise<TreeEntry[]> {
  const m = r.match(/^https:\/\/github\.com\/([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)$/);
  if (!m) throw fail('E_GIT_MISSING');
  const doFetch = opts.fetchImpl ?? fetch;
  // La URL ya está anclada al SHA; nunca se siguen redirecciones a otro host (security §4.1).
  const url = `https://codeload.github.com/${m[1]}/${m[2]}/tar.gz/${c}`;
  opts.log?.(`GET ${url}`);
  let res: Response;
  try {
    res = await doFetch(url, { redirect: 'error', signal: AbortSignal.timeout(opts.timeoutMs ?? 60_000) });
  } catch {
    throw fail('E_NETWORK', { host: 'codeload.github.com' });
  }
  if (!res.ok || !res.body) throw fail('E_UPSTREAM_GIT', { detail: `codeload ${res.status}` });
  return extractTarball(tmp, r, c, i, await gunzip(res.body, 200 * 1024 * 1024));
}

/** Extrae un tar (de codeload o del Verified Archive) comprobando que su comentario pax es el commit esperado. */
async function extractTarball(tmp: string, r: string, c: string, i: string, tar: Uint8Array): Promise<TreeEntry[]> {
  const comment = tarGlobalComment(tar);
  if (comment !== c) throw fail('E_INTEGRITY', { name: r, detail: 'tarball commit mismatch' });
  const entries: TreeEntry[] = [];
  for (const e of readTar(tar, () => true)) {
    const repoPath = e.path.slice(e.path.indexOf('/') + 1);
    if (!repoPath || e.type === 'dir') continue;
    const rel = relativeToInclude(i, repoPath);
    if (rel === null) continue;
    if (e.type === 'symlink') {
      entries.push({ path: rel, mode: 0o120000, type: 'symlink', size: 0, sha1: null });
      continue;
    }
    if (e.type !== 'file' || !e.content) continue;
    const abs = join(tmp, ...repoPath.split('/'));
    if (!abs.startsWith(tmp)) throw fail('E_PATH_UNSAFE', { path: repoPath, reason: 'outside_root' });
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, e.content, { mode: 0o644 });
    entries.push({ path: rel, mode: e.mode, type: 'file', size: e.content.length, sha1: gitBlobSha1(e.content) });
  }
  return entries;
}

/**
 * Obtiene el árbol de `r@c` (filtrado por `i`) en la caché inmutable. Un SHA nunca cambia ⇒ nunca se invalida.
 * Requiere un SHA completo: jamás un tag ni una rama (INV-1).
 */
export async function fetchSource(
  src: { r: string; c: string; i?: string },
  options: FetchOptions = {},
): Promise<FetchedSource> {
  const opts = { ...testDefaults, ...options };
  const { r, c } = src;
  const i = src.i ?? '.';
  if (!SHA_RE.test(c)) throw fail('E_REF_MUTABLE', { ref: c });
  const url = new URL(r);
  if (url.protocol !== 'https:' && !(url.protocol === 'file:' && opts.allowFileProtocol))
    throw fail('E_UPSTREAM_GIT', { detail: `${url.protocol} not allowed` });
  const cacheDir = opts.cacheDir ?? defaultCacheDir();
  const final = cachePath(cacheDir, r, c, i);
  const treeFile = join(final, TREE_FILE);
  if (await exists(treeFile)) {
    const tree = JSON.parse(await readFile(treeFile, 'utf8')) as { c: string; entries: TreeEntry[] };
    if (tree.c === c) return { dir: final, entries: tree.entries, c, via: 'cache' };
  }
  await mkdir(dirname(final), { recursive: true });
  const tmp = await mkdtemp(join(dirname(final), '.tmp-'));
  try {
    let entries: TreeEntry[];
    let via: FetchedSource['via'];
    const strategy = opts.strategy ?? 'auto';
    const primary = async (): Promise<[TreeEntry[], 'git' | 'tarball']> => {
      if (strategy === 'tarball') return [await viaTarball(tmp, r, c, i, opts), 'tarball'];
      const v = strategy === 'git' ? '9.9.9' : await gitVersion();
      if (!gitAtLeast(v)) return [await viaTarball(tmp, r, c, i, opts), 'tarball'];
      try {
        return [await viaGit(tmp, r, c, i, opts), 'git'];
      } catch (e) {
        // Fallback tarball solo si el host no permite fetch por SHA o falla la red; nunca ante un fallo de integridad.
        if (
          strategy === 'git' ||
          (e as { code?: string }).code !== 'E_UPSTREAM_GIT' ||
          !r.startsWith('https://github.com/')
        )
          throw e;
        await rm(tmp, { recursive: true, force: true });
        await mkdir(tmp, { recursive: true });
        return [await viaTarball(tmp, r, c, i, opts), 'tarball'];
      }
    };
    try {
      [entries, via] = await primary();
    } catch (e) {
      // Verified Archive: solo ante red o repo inaccesible (E_NETWORK/E_UPSTREAM_GIT/E_GIT_MISSING), nunca ante un fallo
      // de integridad o de ruta. Los bytes ya vienen verificados (firma del registry + sha256) y aquí se exige además
      // que el comentario pax del tar sea el commit esperado.
      const code = (e as { code?: string }).code;
      if (!opts.mirror || !['E_NETWORK', 'E_UPSTREAM_GIT', 'E_GIT_MISSING'].includes(code ?? '')) throw e;
      const gz = await opts.mirror();
      if (!gz) throw e;
      await rm(tmp, { recursive: true, force: true });
      await mkdir(tmp, { recursive: true });
      opts.log?.(`verified archive for ${r}@${c.slice(0, 12)}`);
      entries = await extractTarball(
        tmp,
        r,
        c,
        i,
        await gunzip(new Blob([gz]).stream() as ReadableStream<Uint8Array>, 200 * 1024 * 1024),
      );
      via = 'archive';
    }
    await writeFile(join(tmp, TREE_FILE), JSON.stringify({ c, i, entries }), { mode: 0o644 });
    try {
      await rename(tmp, final);
    } catch {
      // Otro proceso llenó la caché a la vez: el contenido es idéntico (mismo SHA).
      await rm(tmp, { recursive: true, force: true });
    }
    const tree = JSON.parse(await readFile(treeFile, 'utf8')) as { entries: TreeEntry[] };
    return { dir: final, entries: tree.entries, c, via };
  } catch (e) {
    await rm(tmp, { recursive: true, force: true });
    throw e;
  }
}

/** Ruta absoluta de una entrada (relativa a `i`) dentro del árbol en caché. */
export function sourcePath(src: FetchedSource, i: string, rel: string): string {
  return join(src.dir, ...(i === '.' ? [] : i.split('/')), ...rel.split('/'));
}

export async function cleanCache(cacheDir = defaultCacheDir()): Promise<void> {
  await rm(cacheDir, { recursive: true, force: true });
}
