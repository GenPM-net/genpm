// Cliente tipado del registry (api-spec) con enrutado por scope vía `.genpmrc`. Solo HTTPS (http solo en localhost),
// timeouts (10 s conexión / 60 s total) y límites de tamaño de respuesta (security §4.1).

import type { ResolvedManifest } from '@genpm/manifest';
import {
  archiveRecord,
  type ErrorCode,
  GenpmError,
  isErrorCode,
  parseSignatureHeader,
  sha256Hex,
  verifyManifest,
} from '@genpm/manifest';
import { fail } from './errors.js';
import { isLocalRegistry } from './keys.js';
import { VERSION } from './version.js';

export type ClientKind = 'cli' | 'mcp';

export type RegistryOptions = {
  registry: string;
  token?: string | null;
  client?: ClientKind;
  /** GENPM_TELEMETRY=0 / DO_NOT_TRACK=1 ⇒ `client=none` (INV-6). */
  telemetry?: boolean;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  log?: (line: string) => void;
};

export type ResolveResponse = {
  root: ResolvedManifest & { sg?: string };
  deps: Array<ResolvedManifest & { sg?: string }>;
  w: Array<{ code: string; n: string; msg: string }>;
  scan: Record<string, 'passed' | 'flagged' | 'failed' | 'pending'>;
};

export type SearchResponse = {
  r: Array<{ n: string; v: string; s: string; k: string[]; i: number; m: 0 | 1; vf: 0 | 1 }>;
  nx: string | null;
};

export type PackageCompact = {
  n: string;
  s: string;
  dt: Record<string, string>;
  latest: (ResolvedManifest & { sg?: string }) | null;
  i: number;
  vf: 0 | 1;
  st: string;
  dep: string | null;
  scan: string | null;
};

export type PackageLong = Record<string, unknown> & { contextPreview: string | null; distTags: Record<string, string> };

export type Advisory = {
  id: string;
  n: string;
  v: string;
  kind: 'advisory' | 'yanked' | 'quarantined';
  severity: string;
  title: string;
  fix: string | null;
};

const MAX_BODY = 8 * 1024 * 1024;

export function telemetryEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return !(env['GENPM_TELEMETRY'] === '0' || env['DO_NOT_TRACK'] === '1' || env['DO_NOT_TRACK'] === 'true');
}

export class RegistryClient {
  readonly base: string;

  constructor(private readonly opts: RegistryOptions) {
    const url = new URL(opts.registry);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocalRegistry(opts.registry))) {
      throw fail('E_USAGE', { detail: `registry must use https (${opts.registry})` });
    }
    this.base = opts.registry.replace(/\/+$/, '');
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    extraHeaders: Record<string, string> = {},
  ): Promise<{ data: T; headers: Headers }> {
    const doFetch = this.opts.fetchImpl ?? fetch;
    const headers: Record<string, string> = {
      accept: 'application/vnd.genpm+json, application/json',
      'accept-language': 'en',
      'user-agent': `genpm/${VERSION} (${this.opts.client ?? 'cli'}; node ${process.versions.node}; ${process.platform})`,
      ...extraHeaders,
    };
    if (this.opts.token) headers['authorization'] = `Bearer ${this.opts.token}`;
    if (body !== undefined) headers['content-type'] = 'application/json';
    const url = `${this.base}${path}`;
    this.opts.log?.(`${method} ${url}`);
    let res: Response;
    try {
      res = await doFetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: 'error',
        signal: AbortSignal.timeout(this.opts.timeoutMs ?? 60_000),
      });
    } catch {
      throw fail('E_NETWORK', { host: new URL(this.base).host });
    }
    const text = await res.text();
    if (text.length > MAX_BODY) throw fail('E_NETWORK', { host: new URL(this.base).host });
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (!res.ok) throw problemToError(res.status, json, new URL(this.base).host);
    return { data: json as T, headers: res.headers };
  }

  /**
   * Verified Archive (V03-02): tar.gz del commit de `name@version` desde la copia del registry, solo si el sha256 de
   * los bytes coincide y la firma del registry sobre {n, v, c, sha256} es válida con `keys`. Si no, `null`.
   */
  async archive(
    name: string,
    version: string,
    commit: string,
    keys: Readonly<Record<string, string>>,
    revoked: readonly string[] = [],
  ): Promise<Uint8Array | null> {
    const doFetch = this.opts.fetchImpl ?? fetch;
    const url = `${this.base}/v1/archive/${name}/${version}`;
    this.opts.log?.(`GET ${url}`);
    let res: Response;
    try {
      res = await doFetch(url, { redirect: 'error', signal: AbortSignal.timeout(this.opts.timeoutMs ?? 60_000) });
    } catch {
      return null;
    }
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength > 64 * 1024 * 1024) return null;
    const h = await sha256Hex(bytes);
    if (h !== res.headers.get('genpm-archive-sha256') || res.headers.get('genpm-commit') !== commit) return null;
    const sg = parseSignatureHeader(res.headers.get('genpm-archive-signature'));
    if (!sg) return null;
    const verdict = await verifyManifest(archiveRecord({ n: name, v: version, c: commit, h }), sg, keys, revoked);
    return verdict.ok ? bytes : null;
  }

  private clientParam(): string {
    return this.opts.telemetry === false ? 'none' : (this.opts.client ?? 'cli');
  }

  search(q: { query?: string; keywords?: string[]; mcp?: boolean; sort?: string; limit?: number; scope?: string }) {
    const p = new URLSearchParams({ fmt: 'c' });
    if (q.query) p.set('q', q.query);
    for (const k of q.keywords ?? []) p.append('k', k);
    if (q.mcp) p.set('mcp', '1');
    if (q.sort) p.set('sort', q.sort);
    if (q.scope) p.set('scope', q.scope);
    p.set('limit', String(q.limit ?? 10));
    return this.request<SearchResponse>('GET', `/v1/search?${p}`).then((r) => r.data);
  }

  resolve(name: string, range = 'latest', opts: { deps?: boolean; installed?: string[] } = {}) {
    const p = new URLSearchParams({ range, fmt: 'c', client: this.clientParam() });
    if (opts.deps) p.set('deps', '1');
    if (opts.installed?.length) p.set('installed', opts.installed.join(','));
    return this.request<ResolveResponse>('GET', `/v1/resolve/${name}?${p}`).then((r) => r.data);
  }

  /** Receta compose (V03-05) por slug. */
  recipe(slug: string) {
    return this.request<{ name: string; summary: string | null; p: string[] }>(
      'GET',
      `/v1/recipes/${encodeURIComponent(slug)}`,
    ).then((r) => r.data);
  }

  recipes() {
    return this.request<{ recipes: Array<{ name: string; summary: string | null; p: string[] }> }>(
      'GET',
      '/v1/recipes',
    ).then((r) => r.data.recipes);
  }

  packageCompact(name: string) {
    return this.request<PackageCompact>('GET', `/v1/packages/${name}?fmt=c`).then((r) => r.data);
  }

  packageLong(name: string) {
    return this.request<PackageLong>('GET', `/v1/packages/${name}`, undefined, { accept: 'application/json' }).then(
      (r) => r.data,
    );
  }

  version(name: string, version: string) {
    return this.request<ResolvedManifest & { sg?: string; yanked: boolean; yankReason: string | null }>(
      'GET',
      `/v1/packages/${name}/versions/${version}?fmt=c`,
    ).then((r) => r.data);
  }

  advisories(pkgs: Array<{ n: string; v: string }>) {
    const p = new URLSearchParams({ p: pkgs.map((x) => `${x.n}@${x.v}`).join(',') });
    return this.request<{ advisories: Advisory[] }>('GET', `/v1/advisories?${p}`).then((r) => r.data);
  }

  keys() {
    return this.request<{ keys: Array<{ keyid: string; publicKey: string; status: string }>; revocation: unknown }>(
      'GET',
      '/v1/keys',
    ).then((r) => r.data);
  }

  publish(body: {
    name: string;
    version: string;
    repo: string;
    ref: string;
    manifestPath?: string;
    distTag?: string;
    dryRun?: boolean;
  }) {
    return this.request<{
      manifest: ResolvedManifest & { sg: string };
      scan: { status: string; findings: unknown[] };
      warnings: Array<{ code: string; detail: string }>;
      url: string;
    }>('POST', '/v1/publish', body).then((r) => r.data);
  }

  yank(name: string, version: string, reason: string) {
    return this.request<{ ok: true; latest: string | null }>('POST', `/v1/packages/${name}/versions/${version}/yank`, {
      reason,
    }).then((r) => r.data);
  }

  exchange(githubToken: string, name: string) {
    return this.request<{ token: string; expiresAt: string; account: { handle: string; orgs: string[] } }>(
      'POST',
      '/v1/auth/github/exchange',
      { githubToken, name },
    ).then((r) => r.data);
  }

  logout() {
    return this.request<{ ok: true }>('POST', '/v1/auth/logout').then((r) => r.data);
  }

  me() {
    return this.request<{
      handle: string;
      orgs: Array<{ handle: string; role: string }>;
      token: { expiresAt: string | null; scopes: string[] } | null;
    }>('GET', '/v1/me').then((r) => r.data);
  }

  async ping(): Promise<number> {
    const t = Date.now();
    await this.request('GET', '/v1/health');
    return Date.now() - t;
  }
}

/** problem+json → GenpmError con el mismo código E_* (api-spec §7). */
export function problemToError(status: number, body: unknown, host: string): GenpmError {
  const b = (body ?? {}) as {
    code?: unknown;
    title?: string;
    fix?: string;
    params?: Record<string, string | number>;
    [k: string]: unknown;
  };
  const code: ErrorCode = isErrorCode(b.code)
    ? b.code
    : status === 429
      ? 'E_RATE_LIMITED'
      : status >= 500
        ? 'E_NETWORK'
        : 'E_BAD_REQUEST';
  if (!isErrorCode(b.code)) return fail(code, { host, detail: `HTTP ${status}` });
  const { type: _t, title: _ti, status: _s, code: _c, detail: _d, fix: _f, requestId, params, ...extra } = b;
  const err = fail(code, params ?? {}, { ...extra, requestId });
  if (b.title && err.message.includes('{')) return new GenpmError(code, b.title, b.fix ?? err.fix, err.details);
  return err;
}
