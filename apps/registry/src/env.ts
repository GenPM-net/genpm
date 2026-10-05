// Bindings y variables del Worker (api-spec §9).

import type { Translator } from '@genpm/i18n';

export type Env = {
  DB: D1Database;
  INSTALLS?: AnalyticsEngineDataset;
  /** Verified Archive (V03-02): tarballs de cada versión publicada. */
  ARCHIVE?: R2Bucket;
  SCAN_QUEUE?: Queue<ScanJob>;
  RL_PUBLIC?: RateLimit;
  RL_AUTH?: RateLimit;
  RL_PUBLISH?: RateLimit;
  RL_EXCHANGE?: RateLimit;
  ENVIRONMENT: 'development' | 'test' | 'staging' | 'production';
  /** `1` = modo solo lectura por incidente (runbook §3). */
  READ_ONLY?: string;
  WEB_ORIGIN: string;
  /** Clave pública de IndexNow (vars de wrangler; vacía = desactivado). */
  INDEXNOW_KEY?: string;
  /** Pepper del HMAC de tokens (security §5). */
  TOKEN_PEPPER?: string;
  /** Sal diaria para el hash de IPs. */
  IP_SALT?: string;
  /** JSON `{ "<keyid>": "<pkcs8 Ed25519 base64url>" }`. */
  SIGNING_KEYS?: string;
  SIGNING_KEY_ID?: string;
  GITHUB_TOKEN?: string;
  GITHUB_APP_ID?: string;
  GITHUB_APP_PRIVATE_KEY?: string;
  GITHUB_OAUTH_CLIENT_ID?: string;
  GITHUB_OAUTH_CLIENT_SECRET?: string;
  /** Solo tests: base del API de GitHub (por defecto https://api.github.com). */
  GITHUB_API_BASE?: string;
  /** Solo tests: base de GitLab (por defecto https://gitlab.com). */
  GITLAB_API_BASE?: string;
  /** Rollup de Analytics Engine vía SQL API (cron horario). */
  CF_ACCOUNT_ID?: string;
  CF_AE_TOKEN?: string;
  GITHUB_RAW_BASE?: string;
};

/** Trabajo de escaneo profundo encolado en publish. */
export type ScanJob = { versionId: string; name: string; version: string };

export type Actor = {
  accountId: string;
  handle: string;
  scopes: string[];
  tokenId: string | null;
  isStaff: boolean;
  /** Paquetes que el token puede tocar (`@scope/name` o `@scope/*`); null = todos los de la cuenta. */
  allowedPackages?: string[] | null;
  /** Tokens de trusted publishing: único repositorio (`owner/repo`) desde el que pueden publicar. */
  repository?: string | null;
};

/** Contexto de tenant obligatorio en la capa de datos (INV-10). */
export type Tenant = { registryId: string; slug: string };

export type Vars = {
  requestId: string;
  locale: string;
  t: Translator;
  tenant: Tenant;
  actor: Actor | null;
};

export type AppEnv = { Bindings: Env; Variables: Vars };
