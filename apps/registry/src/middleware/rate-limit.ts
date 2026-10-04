// Rate limiting por IP y por token (api-spec §3) con el binding de Workers Rate Limiting.
// Lectura anónima 300/60 s por IP · autenticada 1 200/60 s por token · publish y auth exchange con sus propias clases.

import type { MiddlewareHandler } from 'hono';
import type { AppEnv, Env } from '../env.js';
import { httpError } from '../http.js';

type Klass = 'public' | 'auth' | 'publish' | 'exchange';

const BINDING: Record<Klass, keyof Env> = {
  public: 'RL_PUBLIC',
  auth: 'RL_AUTH',
  publish: 'RL_PUBLISH',
  exchange: 'RL_EXCHANGE',
};

/** Host con el que la web llama al registry por Service Binding; desde Internet no se puede llegar con él. */
export const BINDING_HOST = 'registry.internal';

export function clientIp(req: Request): string {
  // La web reenvía la IP del visitante; solo se acepta si la petición llegó por el binding.
  if (new URL(req.url).hostname === BINDING_HOST) {
    const forwarded = req.headers.get('x-genpm-client-ip');
    if (forwarded) return forwarded;
  }
  return req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip') ?? '0.0.0.0';
}

async function tokenKey(authorization: string): Promise<string> {
  const token = authorization.replace(/^Bearer\s+/i, '');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return `t:${[...new Uint8Array(digest).slice(0, 12)].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

export function rateLimit(klass?: Klass): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const auth = c.req.header('authorization');
    const k: Klass = klass ?? (auth ? 'auth' : 'public');
    const limiter = c.env[BINDING[k]] as RateLimit | undefined;
    if (limiter) {
      const key = auth && k !== 'exchange' ? await tokenKey(auth) : `ip:${clientIp(c.req.raw)}`;
      const { success } = await limiter.limit({ key: `${k}:${key}` });
      if (!success) throw httpError('E_RATE_LIMITED', { seconds: 60 });
    }
    await next();
  };
}
