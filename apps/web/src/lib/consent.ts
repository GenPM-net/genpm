// Consentimiento de analítica (ADR-027, art. 22.2 LSSI-CE): mapas de calor y grabaciones con PostHog Cloud EU solo
// tras "Aceptar". Sin decisión o con "Rechazar" no se carga ningún script de PostHog ni se escribe nada suyo en el
// navegador. La decisión se guarda en la cookie de preferencia `genpm_consent` (exenta: recuerda lo que eligió la
// persona). El HTML es el mismo para todos (se puede cachear): el script del sitio lee la cookie y decide.
import type { PostHog } from 'posthog-js';

export const CONSENT_COOKIE = 'genpm_consent';
/** 6 meses: la AEPD recomienda no pedir de nuevo antes de 24 meses ni guardar la decisión más de lo necesario. */
const MAX_AGE = 180 * 86_400;

export type Choice = 'granted' | 'denied';

export function readChoice(cookie: string): Choice | null {
  const m = cookie.match(/(?:^|;\s*)genpm_consent=(granted|denied)(?:;|$)/);
  return (m?.[1] as Choice | undefined) ?? null;
}

export function writeChoice(choice: Choice): void {
  // biome-ignore lint/suspicious/noDocumentCookie: cookie de preferencia propia, sin librería de cookies en el cliente
  document.cookie = `${CONSENT_COOKIE}=${choice}; Max-Age=${MAX_AGE}; Path=/; Secure; SameSite=Lax`;
}

/** Borra lo que PostHog hubiera guardado (cookies `ph_*` y claves `ph_*`/`__ph*` del almacenamiento). */
export function clearTracking(): void {
  for (const c of document.cookie.split(/;\s*/)) {
    const name = c.slice(0, c.indexOf('='));
    // biome-ignore lint/suspicious/noDocumentCookie: borrado de las cookies de PostHog al retirar el consentimiento
    if (name.startsWith('ph_')) document.cookie = `${name}=; Max-Age=0; Path=/; Secure; SameSite=Lax`;
  }
  for (const store of [localStorage, sessionStorage]) {
    try {
      for (const k of Object.keys(store)) if (k.startsWith('ph_') || k.startsWith('__ph')) store.removeItem(k);
    } catch {
      /* sin almacenamiento: no hay nada que borrar */
    }
  }
}

let ph: PostHog | null = null;

/** Carga PostHog (import dinámico: el resto de visitantes no descarga ni un byte) a través del proxy propio /ph. */
export async function startTracking(key: string, uiHost: string): Promise<void> {
  if (ph) {
    ph.opt_in_capturing();
    return;
  }
  const { default: posthog } = await import('posthog-js');
  posthog.init(key, {
    api_host: '/ph',
    ui_host: uiHost,
    persistence: 'localStorage+cookie',
    person_profiles: 'identified_only',
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: true,
    enable_heatmaps: true,
    respect_dnt: true,
    disable_surveys: true,
    // Nunca se graban las páginas de cuenta (tokens recién creados, sesión, panel) ni se ve lo escrito en formularios.
    disable_session_recording: /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:settings|dashboard|admin|login|auth|publish)/i.test(
      location.pathname,
    ),
    session_recording: { maskAllInputs: true, maskTextSelector: '[data-ph-mask]' },
  });
  ph = posthog;
}

export function stopTracking(): void {
  if (ph) {
    ph.opt_out_capturing();
    ph.reset();
  }
  clearTracking();
}

/** Evento de producto (copiar comando, cambiar de pestaña…): solo si PostHog está cargado, es decir, con consentimiento. */
export function track(event: string, props: Record<string, string> = {}): void {
  ph?.capture(event, props);
}
