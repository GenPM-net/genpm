// Cliente del registry para la web (web-ui-spec §7): Service Binding en producción (latencia ~0), URL en desarrollo.
// Caché edge con `stale-if-error`: si el registry cae, se sirve la última copia con un aviso discreto.
import { env } from 'cloudflare:workers';

export type Fetched<T> = { data: T; stale: boolean; status: number };

const ORIGIN = 'https://registry.internal';
const STALE_MAX_AGE = 7 * 86_400;

async function edgeCache(): Promise<Cache | null> {
  return typeof caches !== 'undefined' ? (caches as unknown as { default: Cache }).default : null;
}

export async function registryFetch(
  path: string,
  init: { locale?: string; token?: string | null; method?: string; body?: unknown } = {},
): Promise<Response> {
  const headers: Record<string, string> = { accept: 'application/json', 'accept-language': init.locale ?? 'en' };
  if (init.token) headers['authorization'] = `Bearer ${init.token}`;
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  const req = {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  };
  // En desarrollo se usa la URL (el registry corre aparte con `wrangler dev`).
  if (env.REGISTRY && env.ENVIRONMENT !== 'development')
    return env.REGISTRY.fetch(new Request(`${ORIGIN}${path}`, req));
  return fetch(`${env.REGISTRY_URL ?? 'https://api.genpm.net'}${path}`, req);
}

/** GET con copia de seguridad en caché para servir datos stale si el registry falla. */
export async function registryGet<T>(path: string, locale = 'en'): Promise<Fetched<T | null>> {
  const cache = await edgeCache();
  const key = new Request(`https://stale.genpm.internal/${locale}${path}`);
  try {
    const res = await registryFetch(path, { locale });
    if (res.status === 404 || res.status === 451) return { data: null, stale: false, status: res.status };
    if (!res.ok) throw new Error(`registry ${res.status}`);
    const text = await res.text();
    if (cache) {
      const copy = new Response(text, {
        headers: { 'content-type': 'application/json', 'cache-control': `public, max-age=${STALE_MAX_AGE}` },
      });
      await cache.put(key, copy).catch(() => undefined);
    }
    return { data: JSON.parse(text) as T, stale: false, status: res.status };
  } catch {
    const hit = cache ? await cache.match(key) : undefined;
    if (hit) return { data: (await hit.json()) as T, stale: true, status: 200 };
    return { data: null, stale: true, status: 503 };
  }
}

// ───────────── Tipos de la API (forma larga) ─────────────

export type SearchRow = {
  name: string;
  version: string;
  summary: string | null;
  keywords: string[];
  installs30d: number;
  hasMcp: boolean;
  publisher: { handle: string; verified: boolean };
  license: string | null;
  updatedAt: string | null;
  featured: boolean;
};

export type SearchResponse = {
  results: SearchRow[];
  sponsored: { name: string; version: string; summary: string | null; label: string; campaignId: string } | null;
  next: string | null;
  total: number;
};

export type LongManifest = {
  schema: number;
  name: string;
  version: string;
  summary: string | null;
  repo: string;
  ref: string;
  commit: string;
  dest: string;
  include: string;
  context: string;
  license: string;
  keywords: string[];
  genpmDependencies: Record<string, string>;
  npmDependencies: Record<string, string>;
  env: string[];
  mcp: Array<string | { n: string; c?: string; a?: string[]; u?: string; e?: string[] }>;
  signature: string | null;
};

export type PackageResponse = {
  id: string;
  name: string;
  summary: string | null;
  status: 'active' | 'quarantined' | 'removed';
  repo: string;
  license: string | null;
  keywords: string[];
  category: string | null;
  publisher: { handle: string; kind: string; verified: boolean; avatarUrl: string | null } | null;
  distTags: Record<string, string>;
  latest: LongManifest | null;
  flags: { featured: boolean; sponsored: boolean; deprecated: boolean; deprecationMessage: string | null };
  stats: { installs30d: number; installsTotal: number; weekly: number[] };
  security: {
    scanStatus: string | null;
    scannedAt: string | null;
    findings: Array<{ rule: string; severity: string; path?: string; line?: number; detail: string }>;
  };
  contextPreview: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  sourceStatus?: string;
};

export type VersionRow = {
  v: string;
  t: string;
  c: string;
  publishedAt: string | null;
  yanked: boolean;
  yankReason: string | null;
  scanStatus: string;
};

export type Stats = {
  packages: number;
  publishers: number;
  installs30d: number;
  installsTotal: number;
  withMcp: number;
};
