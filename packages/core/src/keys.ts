// Claves públicas de firma fijadas en el cliente (security §4.3, INV-8): la activa y la siguiente, para rotar
// sin romper clientes antiguos. La revocación llega en GET /v1/keys firmada por la clave raíz offline.

import type { PublicKeys } from '@genpm/manifest';

/** Claves de producción (api.genpm.net), generadas en D0-12 (2026-10-03): k1 activa, k2 siguiente. */
export const PRODUCTION_KEYS: PublicKeys = {
  k1: '3R3kJSaX96z4UiK80FxQkRQs5O10EbKeqVQIzLyu5uY',
  k2: 'NqA6ir6sKdo1pmSVFhaSVooMC9UQwQE84SwUgOdhGCs',
};

/** Clave raíz offline que firma la lista de revocación. */
export const ROOT_PUBLIC_KEY: string | null = 'wTGhAITWmijUHUcz4oKO87hmkqyo71tN5RfDfh1zPKA';

/** Clave de desarrollo (apps/registry/scripts/dev-key.mjs): SOLO válida contra registries locales. */
export const DEV_KEYS: PublicKeys = { dev1: 'ZSTMDFblyaEtVTOS3OAY6ZCDKaA7BT0VIBhT7N7CmsU' };

export function isLocalRegistry(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return (
      hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname.endsWith('.localhost')
    );
  } catch {
    return false;
  }
}

/** Claves aceptadas para un registry. `GENPM_PUBLIC_KEYS` (JSON) añade claves de registries privados o staging. */
export function keysFor(registry: string, env: Record<string, string | undefined> = process.env): PublicKeys {
  const extra = env['GENPM_PUBLIC_KEYS'] ? (JSON.parse(env['GENPM_PUBLIC_KEYS']) as PublicKeys) : {};
  return isLocalRegistry(registry) ? { ...PRODUCTION_KEYS, ...DEV_KEYS, ...extra } : { ...PRODUCTION_KEYS, ...extra };
}
