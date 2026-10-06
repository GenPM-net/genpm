'use client';
// Banner y centro de preferencias. "Rechazar todo" y "Aceptar todo" con la misma jerarquía visual; nada preseleccionado.
// Sin estilos propios: usa las clases `consent-*` (o `className`) desde tu CSS / @core/ui.
import { createElement as h, type ReactNode, useEffect, useState } from 'react';

export type ConsentLabels = {
  title: string;
  text: string;
  acceptAll: string;
  rejectAll: string;
  customize: string;
  save: string;
  policyLink: string;
  categories: Record<'analytics' | 'marketing' | 'preferences', { label: string; description: string }>;
};

export const DEFAULT_LABELS: ConsentLabels = {
  title: 'Cookies',
  text: 'We use cookies that are necessary for the site to work and, only if you agree, cookies to measure usage and for marketing.',
  acceptAll: 'Accept all',
  rejectAll: 'Reject all',
  customize: 'Customize',
  save: 'Save choices',
  policyLink: 'Cookie policy',
  categories: {
    analytics: { label: 'Analytics', description: 'Anonymous statistics to improve the site.' },
    marketing: { label: 'Marketing', description: 'Measure ads and show relevant offers.' },
    preferences: { label: 'Preferences', description: 'Remember your settings.' },
  },
};

type Choices = { analytics: boolean; marketing: boolean; preferences: boolean };

/** Lee el estado del navegador (la cookie no es HttpOnly a propósito: los scripts deben poder respetarla). */
export function readClientConsent(): { decided: boolean; choices: Choices; version?: string } {
  const raw = document.cookie.split(/;\s*/).find((c) => c.startsWith('consent='))?.slice(8);
  try {
    const p = JSON.parse(atob(decodeURIComponent(raw ?? '').replaceAll('-', '+').replaceAll('_', '/'))) as { v: string; c: Choices };
    return { decided: true, choices: { analytics: !!p.c.analytics, marketing: !!p.c.marketing, preferences: !!p.c.preferences }, version: p.v };
  } catch {
    return { decided: false, choices: { analytics: false, marketing: false, preferences: false } };
  }
}

const EVENT = 'consentchange';

async function save(endpoint: string, choices: Choices, action: string) {
  await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...choices, action }), credentials: 'same-origin' });
  window.dispatchEvent(new CustomEvent(EVENT, { detail: choices }));
  const g = (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag;
  if (g) g('consent', 'update', { ad_storage: choices.marketing ? 'granted' : 'denied', ad_user_data: choices.marketing ? 'granted' : 'denied', ad_personalization: choices.marketing ? 'granted' : 'denied', analytics_storage: choices.analytics ? 'granted' : 'denied' });
}

/** Abre el centro de preferencias desde cualquier enlace ("Preferencias de cookies" en el pie). */
export const openConsentPreferences = () => window.dispatchEvent(new Event('consentopen'));

export function ConsentBanner(props: { policyVersion: string; policyHref: string; endpoint?: string; labels?: Partial<ConsentLabels>; className?: string }): ReactNode {
  const l = { ...DEFAULT_LABELS, ...props.labels };
  const endpoint = props.endpoint ?? '/api/consent';
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [choices, setChoices] = useState<Choices>({ analytics: false, marketing: false, preferences: false });
  useEffect(() => {
    const c = readClientConsent();
    setChoices(c.choices);
    setOpen(!c.decided || c.version !== props.policyVersion);
    const reopen = () => {
      setCustom(true);
      setOpen(true);
    };
    window.addEventListener('consentopen', reopen);
    return () => window.removeEventListener('consentopen', reopen);
  }, [props.policyVersion]);
  if (!open) return null;
  const finish = async (c: Choices, action: string) => {
    await save(endpoint, c, action);
    setChoices(c);
    setOpen(false);
  };
  const all = (v: boolean) => ({ analytics: v, marketing: v, preferences: v });
  return h(
    'div',
    { role: 'dialog', 'aria-modal': false, 'aria-labelledby': 'consent-title', className: props.className ?? 'consent-banner' },
    h('h2', { id: 'consent-title' }, l.title),
    h('p', null, l.text, ' ', h('a', { href: props.policyHref }, l.policyLink)),
    custom &&
      h(
        'fieldset',
        { className: 'consent-categories' },
        (['analytics', 'marketing', 'preferences'] as const).map((k) =>
          h('label', { key: k }, h('input', { type: 'checkbox', checked: choices[k], onChange: (e: { target: { checked: boolean } }) => setChoices({ ...choices, [k]: e.target.checked }) }), ` ${l.categories[k].label} — ${l.categories[k].description}`),
        ),
      ),
    h(
      'div',
      { className: 'consent-actions' },
      h('button', { type: 'button', className: 'consent-button', onClick: () => finish(all(false), 'banner') }, l.rejectAll),
      custom
        ? h('button', { type: 'button', className: 'consent-button', onClick: () => finish(choices, 'preferences') }, l.save)
        : h('button', { type: 'button', className: 'consent-button', onClick: () => setCustom(true) }, l.customize),
      h('button', { type: 'button', className: 'consent-button', onClick: () => finish(all(true), 'banner') }, l.acceptAll),
    ),
  );
}

/** Pinta `children` solo con consentimiento para `category` (y reacciona a cambios sin recargar). */
export function ConsentGate(props: { category: 'analytics' | 'marketing' | 'preferences'; children?: ReactNode; fallback?: ReactNode }): ReactNode {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    setOk(readClientConsent().choices[props.category]);
    const on = (e: Event) => setOk(!!(e as CustomEvent<Choices>).detail?.[props.category]);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, [props.category]);
  return ok ? (props.children ?? null) : (props.fallback ?? null);
}
