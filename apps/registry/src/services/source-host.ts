// Origen del código de un paquete (V03-03): GitHub o GitLab detrás de un mismo contrato, para que publish, el cron
// de auditoría de tags y el diff entre versiones no dependan del host.

import type { Env } from '../env.js';
import { GitHub, parseGithubRepo } from './github.js';
import { GitLab, parseGitlabRepo } from './gitlab.js';

type Raw =
  | { status: 'ok'; text: string; bytes: number }
  | { status: 'missing' }
  | { status: 'too_large'; bytes: number };

export type SourceHost = {
  kind: 'github' | 'gitlab';
  /** `github.com` o `gitlab.com` (columna `scopes.git_host`). */
  host: string;
  /** `owner/repo` o `group/subgroup/project`. */
  path: string;
  /** Primer segmento de la ruta: dueño en GitHub o grupo raíz en GitLab. */
  owner: string;
  /** URL canónica (`r` del manifiesto resuelto). */
  url: string;
  /** Identidad para trusted publishing (`api_tokens.repository`): `owner/repo` o `gitlab.com/<path>`. */
  identity: string;
  repo(): Promise<{ id: number; private: boolean } | null>;
  isTag(ref: string): Promise<boolean>;
  isBranch(ref: string): Promise<boolean>;
  commitSha(ref: string): Promise<string | null>;
  raw(sha: string, file: string, maxBytes: number): Promise<Raw>;
  license(): Promise<string | null>;
  tarball(sha: string): Promise<ReadableStream<Uint8Array>>;
};

export function sourceHost(env: Env, url: string): SourceHost | null {
  const gh = parseGithubRepo(url);
  if (gh) {
    const api = new GitHub(env);
    const { owner, repo } = gh;
    return {
      kind: 'github',
      host: 'github.com',
      path: `${owner}/${repo}`,
      owner,
      url: `https://github.com/${owner}/${repo}`,
      identity: `${owner}/${repo}`,
      repo: () => api.repo(owner, repo),
      isTag: (ref) => api.isTag(owner, repo, ref),
      isBranch: (ref) => api.isBranch(owner, repo, ref),
      commitSha: (ref) => api.commitSha(owner, repo, ref),
      raw: (sha, file, max) => api.raw(owner, repo, sha, file, max),
      license: () => api.license(owner, repo),
      tarball: (sha) => api.tarball(owner, repo, sha),
    };
  }
  const gl = parseGitlabRepo(url);
  if (gl) {
    const api = new GitLab(env);
    const { path } = gl;
    return {
      kind: 'gitlab',
      host: 'gitlab.com',
      path,
      owner: path.split('/')[0]!,
      url: `https://gitlab.com/${path}`,
      identity: `gitlab.com/${path}`,
      repo: () => api.repo(path),
      isTag: (ref) => api.isTag(path, ref),
      isBranch: (ref) => api.isBranch(path, ref),
      commitSha: (ref) => api.commitSha(path, ref),
      raw: (sha, file, max) => api.raw(path, sha, file, max),
      license: () => api.license(path),
      tarball: (sha) => api.tarball(path, sha),
    };
  }
  return null;
}
