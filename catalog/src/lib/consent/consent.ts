// Consentimiento de cookies: estado en una cookie de primera parte, registro de prueba en BD, comprobación en servidor
// y valores para Google Consent Mode v2. "Rechazar" debe ser tan fácil como "Aceptar" (lo garantiza el banner).
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { type Executor, getDb, newId } from '../db/index.ts';
import { consentRecords } from './schema.ts';

export const CATEGORIES = ['analytics', 'marketing', 'preferences'] as const;
export type Category = (typeof CATEGORIES)[number] | 'necessary';
export const CONSENT_COOKIE = 'consent';
const MAX_AGE_DAYS = 180;

export type ConsentState = {
  /** Hay una decisión vigente (misma versión de la política). */
  decided: boolean;
  subjectId: string | null;
  policyVersion: string | null;
  choices: Record<(typeof CATEGORIES)[number], boolean>;
};

export const policyVersion = () => process.env.CONSENT_POLICY_VERSION ?? '1';
const none = () => Object.fromEntries(CATEGORIES.map((c) => [c, false])) as ConsentState['choices'];

const b64 = (s: string) => btoa(s).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
const unb64 = (s: string) => atob(s.replaceAll('-', '+').replaceAll('_', '/'));

const Stored = z.object({ s: z.string().regex(/^cns_[0-9A-Za-z]{26}$|^[0-9A-Za-z_]{8,40}$/), v: z.string().max(20), c: z.record(z.string(), z.boolean()) });

/** Estado actual desde la cabecera Cookie. Sin cookie o con otra versión de la política: no decidido (todo a false). */
export function getConsent(cookieHeader: string | null | undefined): ConsentState {
  const raw = (cookieHeader ?? '').split(/;\s*/).find((c) => c.startsWith(`${CONSENT_COOKIE}=`))?.slice(CONSENT_COOKIE.length + 1);
  if (raw) {
    try {
      const parsed = Stored.parse(JSON.parse(unb64(decodeURIComponent(raw))));
      if (parsed.v === policyVersion()) {
        const choices = none();
        for (const c of CATEGORIES) choices[c] = parsed.c[c] === true;
        return { decided: true, subjectId: parsed.s, policyVersion: parsed.v, choices };
      }
      return { decided: false, subjectId: parsed.s, policyVersion: parsed.v, choices: none() };
    } catch {
      // Cookie dañada o manipulada: como si no hubiera decisión.
    }
  }
  return { decided: false, subjectId: null, policyVersion: null, choices: none() };
}

/** ¿Hay consentimiento para esta categoría? `necessary` siempre es true. */
export const hasConsent = (cookieHeader: string | null | undefined, category: Category) =>
  category === 'necessary' || getConsent(cookieHeader).choices[category];

export const ChoicesInput = z.object({ analytics: z.boolean().default(false), marketing: z.boolean().default(false), preferences: z.boolean().default(false) });

/**
 * Guarda una decisión: registro de prueba + cookie. Devuelve la cabecera Set-Cookie (y las que borran cookies de
 * categorías retiradas, si se indican en `cookiesByCategory`).
 */
export async function recordConsent(
  input: { choices: z.input<typeof ChoicesInput>; action?: 'banner' | 'preferences' | 'withdraw'; cookieHeader?: string | null },
  opts: { secure?: boolean; cookiesByCategory?: Partial<Record<(typeof CATEGORIES)[number], string[]>> } = {},
  db: Executor = getDb(),
): Promise<{ state: ConsentState; setCookies: string[] }> {
  const choices = ChoicesInput.parse(input.choices);
  const prev = getConsent(input.cookieHeader);
  const subjectId = prev.subjectId ?? newId('cns');
  await db.insert(consentRecords).values({ subjectId, choices, policyVersion: policyVersion(), action: input.action ?? 'banner' });
  const value = encodeURIComponent(b64(JSON.stringify({ s: subjectId, v: policyVersion(), c: choices })));
  const secure = opts.secure ?? process.env.NODE_ENV === 'production';
  const setCookies = [`${CONSENT_COOKIE}=${value}; Path=/; SameSite=Lax; Max-Age=${MAX_AGE_DAYS * 86_400}${secure ? '; Secure' : ''}`];
  // Al retirar una categoría, se borran sus cookies conocidas (p. ej. `_ga`, `_fbp`).
  for (const c of CATEGORIES)
    if (!choices[c]) for (const name of opts.cookiesByCategory?.[c] ?? []) if (/^[\w.-]{1,64}$/.test(name)) setCookies.push(`${name}=; Path=/; Max-Age=0`);
  return { state: { decided: true, subjectId, policyVersion: policyVersion(), choices }, setCookies };
}

/** Historial de un navegador (para atender una solicitud de prueba o de acceso). */
export async function consentHistory(subjectId: string, db: Executor = getDb()) {
  return db.select().from(consentRecords).where(eq(consentRecords.subjectId, subjectId)).orderBy(asc(consentRecords.createdAt));
}

/** Valores de Google Consent Mode v2 para `gtag('consent', 'default'|'update', …)`. */
export function consentModeValues(state: ConsentState) {
  const g = (b: boolean) => (b ? 'granted' : 'denied');
  return {
    ad_storage: g(state.choices.marketing),
    ad_user_data: g(state.choices.marketing),
    ad_personalization: g(state.choices.marketing),
    analytics_storage: g(state.choices.analytics),
    functionality_storage: 'granted',
    personalization_storage: g(state.choices.preferences),
    security_storage: 'granted',
  } as const;
}

/** Script en línea con los valores por defecto de Consent Mode (va antes de cualquier etiqueta de Google). */
export function consentModeDefaultsScript(state: ConsentState): string {
  return `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('consent','default',${JSON.stringify({ ...consentModeValues(state), wait_for_update: 500 }).replaceAll('<', '\\u003c')});`;
}
