// Comprobaciones de formulario: honeypot, tiempo mínimo firmado, captcha (Turnstile o hCaptcha) e IP del cliente.
import { hmacHex, safeEqual } from './crypto.js';
import { antispamSecret } from './rate-limit.js';

/** Campo trampa: invisible para personas, los bots lo rellenan. */
export const HONEYPOT_FIELD = 'website';
/** Campo con la hora firmada de cuando se pintó el formulario. */
export const TIMING_FIELD = '_ts';

/** Atributos para el campo trampa (ocultarlo con CSS, no con `type="hidden"`, que los bots ignoran). */
export const honeypotProps = {
  name: HONEYPOT_FIELD,
  type: 'text',
  tabIndex: -1,
  autoComplete: 'off',
  'aria-hidden': true,
  style: { position: 'absolute', left: '-10000px', width: '1px', height: '1px', overflow: 'hidden' },
} as const;

export function isHoneypotFilled(value: unknown): boolean {
  return typeof value === 'string' && value.trim() !== '';
}

/** Token para el campo `_ts`: `<ms>.<hmac>`. Se genera al pintar el formulario (servidor). */
export async function formTimingToken(now = Date.now(), secret?: string): Promise<string> {
  return `${now}.${await hmacHex(antispamSecret(secret), `ts:${now}`)}`;
}

/** `ok` si el token es auténtico y el formulario tardó entre `minMs` y `maxMs` en enviarse. */
export async function checkFormTiming(
  token: unknown,
  opts: { minMs?: number; maxMs?: number; now?: number; secret?: string } = {},
): Promise<'ok' | 'invalid' | 'too_fast' | 'expired'> {
  if (typeof token !== 'string') return 'invalid';
  const [ts, sig] = token.split('.');
  const t = Number(ts);
  if (!ts || !sig || !Number.isSafeInteger(t)) return 'invalid';
  if (!safeEqual(sig, await hmacHex(antispamSecret(opts.secret), `ts:${t}`))) return 'invalid';
  const elapsed = (opts.now ?? Date.now()) - t;
  if (elapsed < (opts.minMs ?? 2000)) return 'too_fast';
  if (elapsed > (opts.maxMs ?? 86_400_000)) return 'expired';
  return 'ok';
}

export type CaptchaProvider = 'turnstile' | 'hcaptcha';

const VERIFY_URL: Record<CaptchaProvider, string> = {
  turnstile: 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
  hcaptcha: 'https://api.hcaptcha.com/siteverify',
};

/** Campo del formulario donde cada widget deja su respuesta. */
export const CAPTCHA_FIELD: Record<CaptchaProvider, string> = {
  turnstile: 'cf-turnstile-response',
  hcaptcha: 'h-captcha-response',
};

export type CaptchaConfig = { provider: CaptchaProvider; secret: string };

/** Captcha configurado por env (`TURNSTILE_SECRET_KEY` o `HCAPTCHA_SECRET_KEY`), o null si no hay. */
export function captchaFromEnv(env: Record<string, string | undefined> = process.env): CaptchaConfig | null {
  if (env.TURNSTILE_SECRET_KEY) return { provider: 'turnstile', secret: env.TURNSTILE_SECRET_KEY };
  if (env.HCAPTCHA_SECRET_KEY) return { provider: 'hcaptcha', secret: env.HCAPTCHA_SECRET_KEY };
  return null;
}

/** Verifica la respuesta del widget contra el proveedor. Falla cerrado ante errores de red. */
export async function verifyCaptcha(
  response: unknown,
  cfg: CaptchaConfig,
  opts: { remoteIp?: string | null; fetch?: typeof fetch; signal?: AbortSignal } = {},
): Promise<boolean> {
  if (typeof response !== 'string' || !response || response.length > 4096) return false;
  const body = new URLSearchParams({ secret: cfg.secret, response });
  if (opts.remoteIp) body.set('remoteip', opts.remoteIp);
  try {
    const res = await (opts.fetch ?? fetch)(VERIFY_URL[cfg.provider], {
      method: 'POST',
      body,
      signal: opts.signal ?? AbortSignal.timeout(5000),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: unknown };
    return data.success === true;
  } catch {
    return false;
  }
}

/**
 * IP del cliente según las cabeceras de la plataforma. Solo es fiable detrás de un proxy que las fije
 * (Cloudflare, Vercel, un balanceador): úsala para limitar frecuencia, nunca para autorizar.
 */
export function clientIp(headers: Headers): string | null {
  const direct = headers.get('cf-connecting-ip') ?? headers.get('x-real-ip');
  if (direct) return direct.trim();
  const fwd = headers.get('x-forwarded-for');
  return fwd ? (fwd.split(',')[0]?.trim() ?? null) : null;
}
