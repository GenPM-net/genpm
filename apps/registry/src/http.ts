// Errores HTTP del registry: siempre GenpmError con el catálogo único de @genpm/manifest (AGENTS.md).

import { en, errorText } from '@genpm/i18n';
import { type ErrorCode, GenpmError } from '@genpm/manifest';

export function httpError(code: ErrorCode, params: Record<string, string | number> = {}, extra: Record<string, unknown> = {}): GenpmError {
  const { message, fix } = errorText(en, code, params);
  return new GenpmError(code, message, fix, { params, ...extra });
}
