// Anti-spam sin terceros para los formularios públicos: un token con la hora de render firmado (HMAC). Un bot que
// envía en menos de 3 s, reutiliza un formulario de hace horas o se inventa el campo queda fuera. Complementa al
// honeypot, al rate limit del registry y a Turnstile cuando está configurado.
import { env } from 'cloudflare:workers';

const MIN_MS = 3_000;
const MAX_MS = 2 * 3_600_000;

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.SESSION_PEPPER ?? 'dev-only'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`form:${data}`));
  return btoa(String.fromCharCode(...new Uint8Array(sig).slice(0, 16))).replace(/[+/=]/g, '');
}

export async function formToken(now = Date.now()): Promise<string> {
  return `${now}.${await hmac(String(now))}`;
}

export async function checkFormToken(token: unknown, now = Date.now()): Promise<boolean> {
  const [ts, sig] = String(token ?? '').split('.');
  const t = Number(ts);
  if (!sig || !Number.isFinite(t) || now - t < MIN_MS || now - t > MAX_MS) return false;
  return sig === (await hmac(ts!));
}
