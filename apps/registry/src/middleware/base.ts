// Middleware transversal: requestId, idioma, cabeceras de seguridad y CORS (api-spec §1, security §5).

import { createT, negotiateAcceptLanguage } from '@genpm/i18n';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../env.js';
import { ulid } from '../ids.js';

export const requestId: MiddlewareHandler<AppEnv> = async (c, next) => {
  const id = ulid();
  c.set('requestId', id);
  c.set('actor', null);
  await next();
  c.header('genpm-request-id', id);
};

export const locale: MiddlewareHandler<AppEnv> = async (c, next) => {
  const fromQuery = c.req.query('lang');
  const loc = negotiateAcceptLanguage(fromQuery ?? c.req.header('accept-language'));
  c.set('locale', loc);
  c.set('t', await createT(loc, ['errors']));
  await next();
  c.header('Content-Language', loc);
  c.header('Vary', 'Accept-Language', { append: true });
};

export const securityHeaders: MiddlewareHandler<AppEnv> = async (c, next) => {
  await next();
  c.header('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('X-Frame-Options', 'DENY');
};

/** CORS: `*` solo en GET públicos sin credenciales; escrituras solo desde la web (api-spec §1). */
export const cors: MiddlewareHandler<AppEnv> = async (c, next) => {
  const origin = c.req.header('origin');
  const method = c.req.method;
  if (method === 'OPTIONS') {
    const allowWrite = origin === c.env.WEB_ORIGIN;
    const headers: Record<string, string> = {
      'Access-Control-Allow-Origin': allowWrite ? c.env.WEB_ORIGIN : '*',
      'Access-Control-Allow-Methods': allowWrite ? 'GET, HEAD, POST, DELETE, OPTIONS' : 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Accept, Accept-Language, Content-Type, Authorization, genpm-registry, If-None-Match',
      'Access-Control-Max-Age': '86400',
    };
    if (allowWrite) {
      headers['Access-Control-Allow-Credentials'] = 'true';
      headers['Vary'] = 'Origin';
    }
    return c.body(null, 204, headers);
  }
  await next();
  if (method === 'GET' || method === 'HEAD') {
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Expose-Headers', 'genpm-request-id, genpm-signature, ETag, Retry-After');
  } else if (origin === c.env.WEB_ORIGIN) {
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Access-Control-Allow-Credentials', 'true');
    c.header('Vary', 'Origin', { append: true });
  }
};

/** Límite de cuerpo de 16 KB en escrituras (security §5). */
export const bodyLimit: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.req.method === 'POST' || c.req.method === 'PUT' || c.req.method === 'PATCH') {
    const len = Number(c.req.header('content-length') ?? '0');
    if (len > 16 * 1024) {
      const { httpError } = await import('../http.js');
      throw httpError('E_PAYLOAD_TOO_LARGE');
    }
  }
  await next();
};
