// Tenancy dedicada (ENT-01, ADR-032): un registro `isolation = 'dedicated'` vive en su propio Worker (mismo código) con
// su propia D1, dentro del namespace de Workers for Platforms `genpm-tenants`. El Worker compartido solo enruta: por
// `/r/<slug>`, cabecera o dominio propio llega aquí y se reenvía tal cual con `env.DISPATCHER.get(script)`. Los Workers
// de un namespace no tienen cron: el compartido les reenvía cada ejecución a `POST /__cron` con `CRON_SECRET`.

import type { Env } from '../env.js';

export type Dedicated = { slug: string; script: string };

/** Script del namespace para un registro dedicado (`settings.dispatch.script`), o null si es compartido. */
export async function dedicatedScript(db: D1Database, slug: string): Promise<string | null> {
  const row = await db
    .prepare(
      "SELECT json_extract(settings, '$.dispatch.script') AS script FROM registries WHERE slug = ?1 AND isolation = 'dedicated'",
    )
    .bind(slug)
    .first<{ script: string | null }>();
  return row?.script ?? null;
}

export async function dispatch(env: Env, script: string, req: Request): Promise<Response | null> {
  if (!env.DISPATCHER) return null;
  try {
    return await env.DISPATCHER.get(script).fetch(req);
  } catch {
    return null;
  }
}

/** Cron del Worker compartido → cada Worker dedicado (no pueden tener Cron Triggers propios). */
export async function fanOutCron(env: Env, cron: string): Promise<number> {
  if (!env.DISPATCHER || !env.CRON_SECRET || env.DEDICATED_TENANT) return 0;
  const { results } = await env.DB.prepare(
    "SELECT slug, json_extract(settings, '$.dispatch.script') AS script FROM registries WHERE isolation = 'dedicated'",
  ).all<{ slug: string; script: string | null }>();
  let ok = 0;
  for (const r of results) {
    if (!r.script) continue;
    const res = await dispatch(
      env,
      r.script,
      new Request('https://registry.internal/__cron', {
        method: 'POST',
        headers: { 'x-genpm-cron': env.CRON_SECRET, 'content-type': 'application/json' },
        body: JSON.stringify({ cron }),
      }),
    );
    if (res?.ok) ok++;
    else
      console.error(
        JSON.stringify({ level: 'error', event: 'dedicated_cron', slug: r.slug, status: res?.status ?? 0 }),
      );
  }
  return ok;
}
