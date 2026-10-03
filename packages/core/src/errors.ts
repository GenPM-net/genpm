// Errores del motor: siempre `GenpmError` con mensaje y `fix` en inglés (texto para LLMs y `--json`).
// Los parámetros viajan en `details.params` para que la CLI re-renderice el mensaje en el idioma del usuario.

import { en, errorText } from '@genpm/i18n';
import { type ErrorCode, GenpmError } from '@genpm/manifest';

export type ErrorParams = Record<string, string | number>;

export function fail(code: ErrorCode, params: ErrorParams = {}, details: Record<string, unknown> = {}): GenpmError {
  const { message, fix } = errorText(en, code, params);
  return new GenpmError(code, message, fix, { params, ...details });
}

export function asGenpmError(e: unknown): GenpmError {
  if (e instanceof GenpmError) return e;
  const detail = e instanceof Error ? e.message : String(e);
  return fail('E_INTERNAL', {}, { cause: detail });
}
