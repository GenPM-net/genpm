// Cliente de GitLab del registry (V03-03): mismo contrato que services/github.ts para publicar desde gitlab.com.
// SSRF (security §5): solo gitlab.com, `redirect: "manual"`. Sin credenciales: solo proyectos públicos.

import type { Env } from '../env.js';
import { httpError } from '../http.js';

const UA = 'genpm-registry';

const SPDX: Record<string, string> = {
  mit: 'MIT',
  'apache-2.0': 'Apache-2.0',
  'bsd-2-clause': 'BSD-2-Clause',
  'bsd-3-clause': 'BSD-3-Clause',
  isc: 'ISC',
  'mpl-2.0': 'MPL-2.0',
  'gpl-2.0': 'GPL-2.0',
  'gpl-3.0': 'GPL-3.0',
  'lgpl-2.1': 'LGPL-2.1',
  'lgpl-3.0': 'LGPL-3.0',
  'agpl-3.0': 'AGPL-3.0',
  unlicense: 'Unlicense',
  'cc0-1.0': 'CC0-1.0',
};

/** `https://gitlab.com/<group>[/<subgroup>…]/<project>` → ruta del proyecto, o null. */
export function parseGitlabRepo(url: string): { path: string } | null {
  const m = url.match(/^https:\/\/gitlab\.com\/((?:[A-Za-z0-9_.-]{1,255}\/){1,20}[A-Za-z0-9_.-]{1,255})$/);
  if (!m || m[1]!.endsWith('.git') || m[1]!.split('/').some((s) => s === '.' || s === '..' || s === '-')) return null;
  return { path: m[1]! };
}

export class GitLab {
  constructor(private readonly env: Env) {}

  private base(): string {
    return this.env.GITLAB_API_BASE ?? 'https://gitlab.com';
  }

  async request(path: string, accept = 'application/json'): Promise<Response> {
    const url = new URL(this.base() + path);
    if (!this.env.GITLAB_API_BASE && url.hostname !== 'gitlab.com')
      throw httpError('E_UPSTREAM_GIT', { detail: 'host not allowed' });
    let res: Response;
    try {
      res = await fetch(url, { headers: { accept, 'user-agent': UA }, redirect: 'manual' });
    } catch {
      throw httpError('E_UPSTREAM_GIT', { detail: url.hostname });
    }
    if (res.status >= 500 || res.status === 429)
      throw httpError('E_UPSTREAM_GIT', { detail: `${url.hostname} ${res.status}` });
    return res;
  }

  async json<T>(path: string): Promise<T | null> {
    const res = await this.request(path);
    if (res.status === 404 || res.status === 401 || res.status === 403) return null;
    if (!res.ok) throw httpError('E_UPSTREAM_GIT', { detail: `GitLab ${res.status}` });
    return (await res.json()) as T;
  }

  private p(path: string): string {
    return `/api/v4/projects/${encodeURIComponent(path)}`;
  }

  async repo(path: string): Promise<{ id: number; private: boolean; path_with_namespace: string } | null> {
    const r = await this.json<{ id: number; visibility: string; path_with_namespace: string }>(this.p(path));
    return r ? { id: r.id, private: r.visibility !== 'public', path_with_namespace: r.path_with_namespace } : null;
  }

  async isTag(path: string, ref: string): Promise<boolean> {
    return (await this.json(`${this.p(path)}/repository/tags/${encodeURIComponent(ref)}`)) !== null;
  }

  async isBranch(path: string, ref: string): Promise<boolean> {
    return (await this.json(`${this.p(path)}/repository/branches/${encodeURIComponent(ref)}`)) !== null;
  }

  async commitSha(path: string, ref: string): Promise<string | null> {
    return (
      (await this.json<{ id: string }>(`${this.p(path)}/repository/commits/${encodeURIComponent(ref)}`))?.id ?? null
    );
  }

  async raw(
    path: string,
    sha: string,
    file: string,
    maxBytes: number,
  ): Promise<
    { status: 'ok'; text: string; bytes: number } | { status: 'missing' } | { status: 'too_large'; bytes: number }
  > {
    const res = await this.request(
      `${this.p(path)}/repository/files/${encodeURIComponent(file)}/raw?ref=${sha}`,
      '*/*',
    );
    if (res.status === 404) return { status: 'missing' };
    if (!res.ok) throw httpError('E_UPSTREAM_GIT', { detail: `raw ${res.status}` });
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length > maxBytes) return { status: 'too_large', bytes: buf.length };
    return { status: 'ok', text: new TextDecoder().decode(buf), bytes: buf.length };
  }

  /** Licencia detectada por GitLab, normalizada a SPDX (solo las comunes; si no, null y gana el manifiesto). */
  async license(path: string): Promise<string | null> {
    const r = await this.json<{ license?: { key?: string } | null }>(`${this.p(path)}?license=true`);
    return SPDX[r?.license?.key ?? ''] ?? null;
  }

  async tarball(path: string, sha: string): Promise<ReadableStream<Uint8Array>> {
    const res = await this.request(`${this.p(path)}/repository/archive.tar.gz?sha=${sha}`, 'application/gzip');
    if (!res.ok || !res.body) throw httpError('E_UPSTREAM_GIT', { detail: `tarball ${res.status}` });
    return res.body;
  }
}
