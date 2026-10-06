// @vitest-environment happy-dom
import { act, createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ConsentBanner, ConsentGate, readClientConsent } from './react.ts';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const setConsent = (v: string, c: Record<string, boolean>) => {
  document.cookie = `consent=${encodeURIComponent(btoa(JSON.stringify({ s: 'cns_01HZZZZZZZZZZZZZZZZZZZZZZZ', v, c })).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, ''))}; path=/`;
};

describe('client consent and the policy version', () => {
  it('a decision made under another policy version counts as undecided (all false)', () => {
    setConsent('2026-01', { analytics: true, marketing: true });
    expect(readClientConsent('2026-01')).toMatchObject({ decided: true, choices: { analytics: true, marketing: true } });
    expect(readClientConsent('2026-10')).toEqual({ decided: false, choices: { analytics: false, marketing: false, preferences: false }, version: '2026-01' });
  });

  it('the banner declares the version in server HTML; ConsentGate honours it or its own prop', async () => {
    expect(renderToString(h(ConsentBanner, { policyVersion: '2026-10', policyHref: '/c' }))).toContain('<meta name="consent-policy-version" content="2026-10"/>');
    setConsent('2026-01', { marketing: true });
    const el = document.createElement('div');
    document.body.appendChild(el);
    const root = createRoot(el);
    const gate = (v?: string) => h(ConsentGate, { category: 'marketing', ...(v && { policyVersion: v }), fallback: 'off' }, 'on');
    await act(async () => root.render(h('div', null, gate('2026-10'), gate('2026-01'))));
    expect(el.textContent).toBe('offon');
    await act(async () => root.render(h('div', null, h(ConsentBanner, { policyVersion: '2026-10', policyHref: '/c' }), gate())));
    expect(el.querySelector('[role=dialog]')).not.toBeNull(); // pregunta otra vez
    expect(el.textContent?.endsWith('off')).toBe(true);
    await act(async () => root.unmount());
  });
});
