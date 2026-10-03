// RFC 9457 `application/problem+json` con los códigos E_* (api-spec §7). `title`/`detail` localizados; `code`/`type` nunca.

import { errorText } from '@genpm/i18n';
import { errorType, GenpmError, httpStatus, isGenpmError } from '@genpm/manifest';
import type { Context } from 'hono';
import type { AppEnv } from '../env.js';
import { httpError } from '../http.js';

export function problem(c: Context<AppEnv>, err: GenpmError): Response {
  const status = httpStatus(err.code);
  const params = (err.details?.['params'] as Record<string, unknown> | undefined) ?? {};
  const t = c.get('t');
  const text = t ? errorText(t, err.code, params) : { message: err.message, fix: err.fix };
  const { params: _p, cause: _c, ...rest } = (err.details ?? {}) as Record<string, unknown>;
  const body = {
    type: errorType(err.code),
    title: text.message,
    status,
    code: err.code,
    detail: typeof params['detail'] === 'string' ? params['detail'] : text.message,
    fix: text.fix,
    requestId: c.get('requestId'),
    // Valores de interpolación (nombres, rutas): permiten a los clientes re-localizar el mensaje.
    params,
    ...rest,
  };
  const headers: Record<string, string> = {
    'Content-Type': 'application/problem+json; charset=utf-8',
    'Cache-Control': 'no-store',
    'genpm-request-id': c.get('requestId') ?? '',
  };
  if (err.code === 'E_RATE_LIMITED') headers['Retry-After'] = String(params['seconds'] ?? 60);
  return new Response(JSON.stringify(body), { status, headers });
}

export function onError(err: unknown, c: Context<AppEnv>): Response {
  if (isGenpmError(err) && err instanceof GenpmError) return problem(c, err);
  console.error(JSON.stringify({ level: 'error', reqId: c.get('requestId'), route: c.req.path, error: String(err) }));
  return problem(c, httpError('E_INTERNAL'));
}

export function notFound(c: Context<AppEnv>): Response {
  return problem(c, httpError('E_NOT_FOUND', { name: c.req.path }));
}
