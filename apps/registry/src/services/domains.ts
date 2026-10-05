// Dominio propio por registro (V10-03). El admin pide `packages.acme.com`; se demuestra la propiedad con un TXT
// `_genpm-challenge.<dominio>` = token (DNS sobre HTTPS de Cloudflare) y, si está configurado Cloudflare for SaaS
// (`CF_SAAS_ZONE_ID` + `CF_SAAS_TOKEN`), se da de alta el custom hostname con certificado gestionado. El CNAME del
// cliente apunta a `domains.genpm.net` (fallback origin de la zona SaaS, servido por este Worker).

import type { Env } from '../env.js';

export const DOMAIN_RE = /^(?=.{4,253}$)(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/;
export const CNAME_TARGET = 'domains.genpm.net';

/** Hosts propios de GenPM: nunca pueden ser el dominio de un cliente. */
export function isOwnHost(host: string): boolean {
  return (
    host === 'genpm.net' ||
    host.endsWith('.genpm.net') ||
    host.endsWith('.workers.dev') ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.endsWith('.internal')
  );
}

export function challengeName(domain: string): string {
  return `_genpm-challenge.${domain}`;
}

/** ¿Publica el dominio el TXT esperado? */
export async function verifyTxt(domain: string, token: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(challengeName(domain))}&type=TXT`;
  const res = await fetchImpl(url, { headers: { accept: 'application/dns-json' } }).catch(() => null);
  if (!res?.ok) return false;
  const body = (await res.json()) as { Answer?: Array<{ data: string }> };
  return (body.Answer ?? []).some((a) => a.data.replace(/^"|"$/g, '') === token);
}

/** Alta del custom hostname en Cloudflare for SaaS (si está configurado). Devuelve el estado del certificado. */
export async function addCustomHostname(env: Env, domain: string): Promise<'active' | 'pending' | 'unconfigured'> {
  if (!env.CF_SAAS_ZONE_ID || !env.CF_SAAS_TOKEN) return 'unconfigured';
  const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${env.CF_SAAS_ZONE_ID}/custom_hostnames`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.CF_SAAS_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ hostname: domain, ssl: { method: 'http', type: 'dv' } }),
  }).catch(() => null);
  if (!res) return 'pending';
  const body = (await res.json().catch(() => ({}))) as { result?: { ssl?: { status?: string } } };
  return body.result?.ssl?.status === 'active' ? 'active' : 'pending';
}

export async function removeCustomHostname(env: Env, domain: string): Promise<void> {
  if (!env.CF_SAAS_ZONE_ID || !env.CF_SAAS_TOKEN) return;
  const headers = { authorization: `Bearer ${env.CF_SAAS_TOKEN}` };
  const base = `https://api.cloudflare.com/client/v4/zones/${env.CF_SAAS_ZONE_ID}/custom_hostnames`;
  const list = await fetch(`${base}?hostname=${encodeURIComponent(domain)}`, { headers }).catch(() => null);
  const id = ((await list?.json().catch(() => ({}))) as { result?: Array<{ id: string }> })?.result?.[0]?.id;
  if (id) await fetch(`${base}/${id}`, { method: 'DELETE', headers }).catch(() => null);
}
