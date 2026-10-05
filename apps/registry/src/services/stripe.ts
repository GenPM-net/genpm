// Stripe sin SDK (V10-05, V10-06): API REST con form-encoding y verificación de la firma de los webhooks
// (`Stripe-Signature: t=…,v1=…`, HMAC-SHA256 de `${t}.${payload}`, tolerancia 5 minutos).

import type { Env } from '../env.js';
import { httpError } from '../http.js';

export function stripeConfigured(env: Env): boolean {
  return Boolean(env.STRIPE_SECRET_KEY);
}

/** `{ a: { b: 1 }, c: [x] }` → `a[b]=1&c[0]=x` (formato de la API de Stripe). */
function form(params: Record<string, unknown>, prefix = '', out = new URLSearchParams()): URLSearchParams {
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v))
      v.forEach((x, i) =>
        typeof x === 'object'
          ? form(x as Record<string, unknown>, `${key}[${i}]`, out)
          : out.append(`${key}[${i}]`, String(x)),
      );
    else if (typeof v === 'object') form(v as Record<string, unknown>, key, out);
    else out.append(key, String(v));
  }
  return out;
}

export async function stripe<T>(
  env: Env,
  method: 'GET' | 'POST',
  path: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  if (!env.STRIPE_SECRET_KEY) throw httpError('E_INTERNAL', { detail: 'billing not configured' });
  const body = form(params);
  const url = `${env.STRIPE_API_BASE ?? 'https://api.stripe.com'}/v1${path}${method === 'GET' && body.size ? `?${body}` : ''}`;
  const res = await fetch(url, {
    method,
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'content-type': 'application/x-www-form-urlencoded',
      'stripe-version': '2024-06-20',
    },
    ...(method === 'POST' ? { body } : {}),
  }).catch(() => null);
  if (!res) throw httpError('E_UPSTREAM_GIT', { detail: 'stripe unreachable' });
  const data = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) throw httpError('E_BAD_REQUEST', { detail: `stripe: ${data.error?.message ?? res.status}` });
  return data;
}

function hex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Verifica la firma y devuelve el evento, o null. */
export async function verifyWebhook(
  secret: string,
  payload: string,
  header: string | undefined,
  now = Date.now(),
): Promise<{ id: string; type: string; data: { object: Record<string, unknown> } } | null> {
  if (!header) return null;
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=') as [string, string]));
  const t = Number(parts['t']);
  const sigs = header
    .split(',')
    .filter((p) => p.startsWith('v1='))
    .map((p) => p.slice(3));
  if (!t || !sigs.length || Math.abs(now / 1000 - t) > 300) return null;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const expected = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${payload}`)));
  // Comparación en tiempo constante.
  const ok = sigs.some(
    (s) =>
      s.length === expected.length &&
      [...s].reduce((d, ch, i) => d | (ch.charCodeAt(0) ^ expected.charCodeAt(i)), 0) === 0,
  );
  if (!ok) return null;
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

/** Solo tests: firma un payload como lo haría Stripe. */
export async function __signWebhook(
  secret: string,
  payload: string,
  t = Math.floor(Date.now() / 1000),
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return `t=${t},v1=${hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${payload}`)))}`;
}
