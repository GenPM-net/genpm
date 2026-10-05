// Catálogo único de códigos de error E_* (AGENTS.md: se definen solo aquí y los comparten API, CLI y MCP).
// Los textos (`message`, `fix`) viven en @genpm/i18n (`locales/<lang>/errors.json`), con el código como clave.
// Los códigos nunca se traducen (i18n §1, principio 3).

import { ERROR_TYPE_BASE } from './constants.js';

type ErrorDef = {
  /** Estado HTTP en el registry (api-spec §7). */
  http: number;
  /** Código de salida del CLI (cli-mcp-spec §A.3). */
  exit: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
};

export const ERRORS = {
  E_INTERNAL: { http: 500, exit: 1 },
  E_BAD_REQUEST: { http: 400, exit: 2 },
  E_USAGE: { http: 400, exit: 2 },
  E_CONFIRM_REQUIRED: { http: 400, exit: 2 },
  E_PAYLOAD_TOO_LARGE: { http: 413, exit: 2 },
  E_NOT_FOUND: { http: 404, exit: 3 },
  E_NO_MATCHING_VERSION: { http: 404, exit: 3 },
  E_DEST_CONFLICT: { http: 409, exit: 4 },
  E_RANGE_UNSATISFIED: { http: 409, exit: 4 },
  E_ALREADY_INSTALLED: { http: 409, exit: 4 },
  E_VERSION_EXISTS: { http: 409, exit: 4 },
  E_DRIFT: { http: 409, exit: 4 },
  E_REQUIRED_BY: { http: 409, exit: 4 },
  E_BUSY: { http: 409, exit: 4 },
  E_PLAN_STALE: { http: 409, exit: 4 },
  E_NETWORK: { http: 502, exit: 5 },
  E_UPSTREAM_GIT: { http: 502, exit: 5 },
  E_RATE_LIMITED: { http: 429, exit: 5 },
  E_READ_ONLY: { http: 503, exit: 5 },
  E_INTEGRITY: { http: 422, exit: 6 },
  E_SIGNATURE: { http: 422, exit: 6 },
  E_PATH_UNSAFE: { http: 422, exit: 6 },
  E_AUTORUN_FILE: { http: 422, exit: 6 },
  E_SCAN_FAILED: { http: 422, exit: 6 },
  E_INSECURE_PERMS: { http: 400, exit: 6 },
  E_QUARANTINED: { http: 451, exit: 6 },
  /** ENT-03: la política de la organización no permite el paquete (lista permitida, escaneo o licencia). */
  E_POLICY: { http: 403, exit: 6 },
  E_REF_MUTABLE: { http: 422, exit: 6 },
  E_ADVISORY: { http: 409, exit: 6 },
  E_TOO_LARGE: { http: 422, exit: 6 },
  E_MANIFEST_INVALID: { http: 422, exit: 6 },
  E_LOCK_INVALID: { http: 422, exit: 6 },
  E_NAME_MISMATCH: { http: 422, exit: 6 },
  E_REF_NOT_FOUND: { http: 422, exit: 3 },
  E_REF_NOT_PUSHED: { http: 422, exit: 4 },
  E_REPO_NOT_ALLOWED: { http: 422, exit: 7 },
  E_REPO_CHANGED: { http: 422, exit: 6 },
  E_CONTEXT_MISSING: { http: 422, exit: 6 },
  E_CONTEXT_TOO_LARGE: { http: 422, exit: 6 },
  E_AUTH: { http: 401, exit: 7 },
  E_FORBIDDEN_SCOPE: { http: 403, exit: 7 },
  E_GIT_MISSING: { http: 500, exit: 8 },
  E_NODE_VERSION: { http: 500, exit: 8 },
  E_UPGRADE_UNSUPPORTED: { http: 400, exit: 8 },
  E_UPGRADE_PERMISSION: { http: 500, exit: 8 },
  E_UPGRADE_INTEGRITY: { http: 422, exit: 6 },
  E_MCP_SERVE_UNAVAILABLE: { http: 500, exit: 8 },
  E_NOT_A_PROJECT: { http: 400, exit: 8 },
} as const satisfies Record<string, ErrorDef>;

export type ErrorCode = keyof typeof ERRORS;

export const ERROR_CODES = Object.keys(ERRORS) as ErrorCode[];

export function isErrorCode(code: unknown): code is ErrorCode {
  return typeof code === 'string' && Object.hasOwn(ERRORS, code);
}

export function httpStatus(code: ErrorCode): number {
  return ERRORS[code].http;
}

export function exitCode(code: ErrorCode): number {
  return ERRORS[code].exit;
}

export function errorType(code: ErrorCode): string {
  return ERROR_TYPE_BASE + code;
}

export type ErrorDetails = Record<string, unknown>;

/** Error compartido por core, CLI y MCP: `{ code, message, fix, details? }` (cli-mcp-spec §0). */
export class GenpmError extends Error {
  readonly code: ErrorCode;
  readonly fix: string;
  readonly details: ErrorDetails | undefined;

  constructor(code: ErrorCode, message: string, fix: string, details?: ErrorDetails) {
    super(message);
    this.name = 'GenpmError';
    this.code = code;
    this.fix = fix;
    this.details = details;
  }

  get exitCode(): number {
    return exitCode(this.code);
  }

  toJSON(): { code: ErrorCode; message: string; fix: string; details?: ErrorDetails } {
    return this.details === undefined
      ? { code: this.code, message: this.message, fix: this.fix }
      : { code: this.code, message: this.message, fix: this.fix, details: this.details };
  }
}

export function isGenpmError(e: unknown): e is GenpmError {
  return (
    e instanceof GenpmError || (typeof e === 'object' && e !== null && isErrorCode((e as { code?: unknown }).code))
  );
}

/** Detalle de validación por campo (`E_MANIFEST_INVALID`). */
export type Issue = { path: string; message: string };
