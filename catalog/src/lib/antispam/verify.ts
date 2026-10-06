// Comprobación completa de un envío público: honeypot → tiempo → límite de frecuencia → captcha.
import type { Executor } from '../db/index.js';
import { getDb } from '../db/index.js';
import {
  CAPTCHA_FIELD,
  type CaptchaConfig,
  captchaFromEnv,
  checkFormTiming,
  clientIp,
  HONEYPOT_FIELD,
  isHoneypotFilled,
  TIMING_FIELD,
  verifyCaptcha,
} from './checks.js';
import { rateLimit } from './rate-limit.js';

export type HumanCheckFailure = 'honeypot' | 'invalid_token' | 'too_fast' | 'expired' | 'rate_limited' | 'captcha';

export type HumanCheckResult = { ok: true } | { ok: false; reason: HumanCheckFailure; retryAfterSeconds?: number };

export type HumanCheckOptions = {
  /** Ámbito del límite: `forms:contact`, `comments`, `newsletter`. */
  scope: string;
  /** Intentos por IP y ventana. Default 10 por 10 min. */
  limit?: number;
  windowMs?: number;
  /** Exigir el token `_ts` (recomendado). Default true. */
  requireTiming?: boolean;
  minMs?: number;
  /** Captcha; por defecto el de las variables de entorno (o ninguno). */
  captcha?: CaptchaConfig | null;
  fetch?: typeof fetch;
  now?: Date;
};

/**
 * Verifica un envío. `fields` son los campos del formulario (FormData u objeto). Sin captcha configurado funciona
 * en modo "honeypot + tiempo + rate limit".
 */
export async function verifyHuman(
  headers: Headers,
  fields: FormData | Record<string, unknown>,
  opts: HumanCheckOptions,
  db: Executor = getDb(),
): Promise<HumanCheckResult> {
  const get = (k: string) => (fields instanceof FormData ? fields.get(k) : fields[k]);
  if (isHoneypotFilled(get(HONEYPOT_FIELD))) return { ok: false, reason: 'honeypot' };
  if (opts.requireTiming !== false) {
    const t = await checkFormTiming(get(TIMING_FIELD), { minMs: opts.minMs, now: opts.now?.getTime() });
    if (t !== 'ok') return { ok: false, reason: t === 'invalid' ? 'invalid_token' : t };
  }
  const ip = clientIp(headers) ?? 'unknown';
  const rl = await rateLimit(
    `${opts.scope}:${ip}`,
    { limit: opts.limit ?? 10, windowMs: opts.windowMs ?? 600_000, now: opts.now },
    db,
  );
  if (!rl.ok) return { ok: false, reason: 'rate_limited', retryAfterSeconds: rl.retryAfterSeconds };
  const captcha = opts.captcha === undefined ? captchaFromEnv() : opts.captcha;
  if (captcha) {
    const passed = await verifyCaptcha(get(CAPTCHA_FIELD[captcha.provider]), captcha, {
      remoteIp: ip === 'unknown' ? null : ip,
      fetch: opts.fetch,
    });
    if (!passed) return { ok: false, reason: 'captcha' };
  }
  return { ok: true };
}
