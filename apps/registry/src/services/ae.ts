// Cliente mínimo de la SQL API de Analytics Engine (cron de instalaciones y panel /v1/admin/analytics).
import type { Env } from '../env.js';

export type AeDataset = 'installs' | 'web';

/** Nombre real del dataset según el entorno (wrangler.jsonc de registry y web). */
export function aeDataset(env: Env, kind: AeDataset): string {
  const base = kind === 'installs' ? 'genpm_installs' : 'genpm_web_events';
  return env.ENVIRONMENT === 'staging' ? `${base}_staging` : base;
}

export function aeConfigured(env: Env): boolean {
  return Boolean(env.CF_ACCOUNT_ID && env.CF_AE_TOKEN);
}

/** Ejecuta una consulta SQL (debe terminar en `FORMAT JSON`). Lanza si AE responde con error. */
export async function aeQuery<T>(env: Env, sql: string, fetchImpl: typeof fetch = fetch): Promise<T[]> {
  const res = await fetchImpl(
    `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/analytics_engine/sql`,
    { method: 'POST', headers: { authorization: `Bearer ${env.CF_AE_TOKEN}` }, body: sql },
  );
  if (!res.ok) throw new Error(`analytics engine ${res.status}`);
  return ((await res.json()) as { data: T[] }).data;
}
