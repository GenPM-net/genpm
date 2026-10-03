// Cliente de GitHub del registry (api-spec §4.5). SSRF (security §5): solo api.github.com, raw.githubusercontent.com
// y codeload.github.com, con `redirect: "manual"`. Autenticación: token de instalación de la GitHub App de GenPM
// (o GITHUB_TOKEN en desarrollo). Nunca se persiste ningún token de GitHub.

import { bytesToBase64Url } from '@genpm/manifest';
import type { Env } from '../env.js';
import { httpError } from '../http.js';

const ALLOWED_HOSTS = new Set(['api.github.com', 'raw.githubusercontent.com', 'codeload.github.com']);
const UA = 'genpm-registry';

let appToken: { token: string; exp: number } | null = null;

function pemToPkcs8(pem: string): Uint8Array {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function appJwt(env: Env): Promise<string> {
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(env.GITHUB_APP_PRIVATE_KEY!) as BufferSource,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const now = Math.floor(Date.now() / 1000);
  const enc = (o: unknown) => bytesToBase64Url(new TextEncoder().encode(JSON.stringify(o)));
  const unsigned = `${enc({ alg: 'RS256', typ: 'JWT' })}.${enc({ iat: now - 60, exp: now + 540, iss: env.GITHUB_APP_ID })}`;
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${bytesToBase64Url(new Uint8Array(sig))}`;
}

async function installationToken(env: Env): Promise<string | null> {
  if (env.GITHUB_TOKEN) return env.GITHUB_TOKEN;
  if (!env.GITHUB_APP_ID || !env.GITHUB_APP_PRIVATE_KEY) return null;
  if (appToken && appToken.exp > Date.now() + 60_000) return appToken.token;
  const jwt = await appJwt(env);
  const headers = { authorization: `Bearer ${jwt}`, accept: 'application/vnd.github+json', 'user-agent': UA };
  const inst = await fetch('https://api.github.com/app/installations', { headers, redirect: 'manual' });
  const list = (await inst.json()) as Array<{ id: number }>;
  if (!list[0]) return null;
  const res = await fetch(`https://api.github.com/app/installations/${list[0].id}/access_tokens`, {
    method: 'POST',
    headers,
    redirect: 'manual',
  });
  const body = (await res.json()) as { token: string; expires_at: string };
  appToken = { token: body.token, exp: Date.parse(body.expires_at) };
  return body.token;
}

export class GitHub {
  constructor(private readonly env: Env) {}

  private base(kind: 'api' | 'raw' | 'codeload'): string {
    if (kind === 'api') return this.env.GITHUB_API_BASE ?? 'https://api.github.com';
    if (kind === 'raw') return this.env.GITHUB_RAW_BASE ?? 'https://raw.githubusercontent.com';
    return this.env.GITHUB_API_BASE ? `${this.env.GITHUB_API_BASE}/codeload` : 'https://codeload.github.com';
  }

  async request(
    kind: 'api' | 'raw' | 'codeload',
    path: string,
    accept = 'application/vnd.github+json',
  ): Promise<Response> {
    const url = new URL(this.base(kind) + path);
    if (!this.env.GITHUB_API_BASE && !ALLOWED_HOSTS.has(url.hostname))
      throw httpError('E_UPSTREAM_GIT', { detail: 'host not allowed' });
    const token = await installationToken(this.env);
    const headers: Record<string, string> = { accept, 'user-agent': UA, 'x-github-api-version': '2022-11-28' };
    if (token) headers['authorization'] = `Bearer ${token}`;
    let res: Response;
    try {
      res = await fetch(url, { headers, redirect: 'manual' });
    } catch {
      throw httpError('E_UPSTREAM_GIT', { detail: url.hostname });
    }
    if (res.status >= 500 || res.status === 403 || res.status === 429)
      throw httpError('E_UPSTREAM_GIT', { detail: `${url.hostname} ${res.status}` });
    return res;
  }

  async json<T>(path: string): Promise<T | null> {
    const res = await this.request('api', path);
    if (res.status === 404) return null;
    if (!res.ok) throw httpError('E_UPSTREAM_GIT', { detail: `GitHub ${res.status}` });
    return (await res.json()) as T;
  }

  repo(o: string, r: string) {
    return this.json<{
      id: number;
      name: string;
      full_name: string;
      private: boolean;
      owner: { login: string };
      default_branch: string;
      html_url: string;
    }>(`/repos/${o}/${r}`);
  }

  /** `true` si el ref existe como tag. */
  async isTag(o: string, r: string, ref: string): Promise<boolean> {
    return (await this.json(`/repos/${o}/${r}/git/ref/tags/${encodeURIComponent(ref)}`)) !== null;
  }

  async isBranch(o: string, r: string, ref: string): Promise<boolean> {
    return (await this.json(`/repos/${o}/${r}/branches/${encodeURIComponent(ref)}`)) !== null;
  }

  async commitSha(o: string, r: string, ref: string): Promise<string | null> {
    const c = await this.json<{ sha: string }>(`/repos/${o}/${r}/commits/${encodeURIComponent(ref)}`);
    return c?.sha ?? null;
  }

  /** Contenido de un archivo en un commit (raw), con límite de tamaño. */
  async raw(
    o: string,
    r: string,
    sha: string,
    path: string,
    maxBytes: number,
  ): Promise<
    { status: 'ok'; text: string; bytes: number } | { status: 'missing' } | { status: 'too_large'; bytes: number }
  > {
    const res = await this.request(
      'raw',
      `/${o}/${r}/${sha}/${path.split('/').map(encodeURIComponent).join('/')}`,
      '*/*',
    );
    if (res.status === 404) return { status: 'missing' };
    if (!res.ok) throw httpError('E_UPSTREAM_GIT', { detail: `raw ${res.status}` });
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length > maxBytes) return { status: 'too_large', bytes: buf.length };
    return { status: 'ok', text: new TextDecoder().decode(buf), bytes: buf.length };
  }

  async license(o: string, r: string): Promise<string | null> {
    const l = await this.json<{ license?: { spdx_id?: string } }>(`/repos/${o}/${r}/license`);
    const id = l?.license?.spdx_id;
    return id && id !== 'NOASSERTION' ? id : null;
  }

  async tarball(o: string, r: string, sha: string): Promise<ReadableStream<Uint8Array>> {
    const res = await this.request('codeload', `/${o}/${r}/tar.gz/${sha}`, 'application/x-gzip');
    if (!res.ok || !res.body) throw httpError('E_UPSTREAM_GIT', { detail: `tarball ${res.status}` });
    return res.body;
  }
}

/** `https://github.com/<owner>/<repo>` → partes, o null si no es un repo de GitHub válido (MVP: solo GitHub). */
export function parseGithubRepo(url: string): { owner: string; repo: string } | null {
  const m = url.match(/^https:\/\/github\.com\/([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100})$/);
  if (!m || m[2]!.endsWith('.git')) return null;
  return { owner: m[1]!, repo: m[2]! };
}
