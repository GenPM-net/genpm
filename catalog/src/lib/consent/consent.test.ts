import { Hono } from 'hono';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { testDb } from '../db/__fixtures__/pglite.ts';
import { consentRoutes } from './adapters/hono.ts';
import { ConsentGate } from './react.ts';
import * as schema from './schema.ts';
import { consentHistory, consentModeDefaultsScript, consentModeValues, cookieDomain, getConsent, hasConsent, recordConsent } from './index.ts';

beforeEach(async () => {
  await testDb(schema);
  process.env.CONSENT_POLICY_VERSION = '2026-10';
  delete process.env.SITE_URL;
  delete process.env.CONSENT_COOKIE_DOMAIN;
});

const cookieOf = (setCookie: string) => setCookie.split(';')[0]!;

describe('consent state', () => {
  it('nothing is allowed before a decision; necessary always is', () => {
    expect(getConsent(null)).toMatchObject({ decided: false, choices: { analytics: false, marketing: false, preferences: false } });
    expect(hasConsent(null, 'necessary')).toBe(true);
    expect(hasConsent('consent=garbage', 'analytics')).toBe(false);
  });

  it('records proof, sets the cookie and reads it back; a new policy version asks again', async () => {
    const { state, setCookies } = await recordConsent({ choices: { analytics: true } }, { secure: true });
    expect(state).toMatchObject({ decided: true, choices: { analytics: true, marketing: false, preferences: false } });
    expect(setCookies[0]).toMatch(/^consent=.+; Path=\/; SameSite=Lax; Max-Age=15552000; Secure$/);
    const cookie = cookieOf(setCookies[0]!);
    expect(hasConsent(cookie, 'analytics')).toBe(true);
    expect(hasConsent(cookie, 'marketing')).toBe(false);
    const again = await recordConsent({ choices: {}, action: 'withdraw', cookieHeader: cookie }, { cookiesByCategory: { analytics: ['_ga', 'bad name;'] } });
    expect(again.state.subjectId).toBe(state.subjectId);
    expect(again.setCookies.slice(1)).toEqual(['_ga=; Path=/; Max-Age=0']);
    expect((await consentHistory(state.subjectId!)).map((r) => [r.action, r.choices.analytics, r.policyVersion])).toEqual([['banner', true, '2026-10'], ['withdraw', false, '2026-10']]);
    process.env.CONSENT_POLICY_VERSION = '2027-01';
    expect(getConsent(cookie)).toMatchObject({ decided: false, subjectId: state.subjectId });
  });

  it('withdrawing also deletes third-party cookies set on the registrable domain', async () => {
    process.env.SITE_URL = 'https://www.shop.example.com/';
    const { setCookies } = await recordConsent({ choices: {}, action: 'withdraw' }, { cookiesByCategory: { analytics: ['_ga'], marketing: ['_fbp'] } });
    expect(setCookies.slice(1)).toEqual(['_ga=; Path=/; Max-Age=0', '_ga=; Path=/; Domain=example.com; Max-Age=0', '_fbp=; Path=/; Max-Age=0', '_fbp=; Path=/; Domain=example.com; Max-Age=0']);
    expect(cookieDomain({ SITE_URL: 'https://shop.example.co.uk', CONSENT_COOKIE_DOMAIN: '.example.co.uk' })).toBe('example.co.uk');
    expect(cookieDomain({ CONSENT_COOKIE_DOMAIN: 'bad;domain' })).toBeNull();
    expect([cookieDomain({ SITE_URL: 'http://localhost:3000' }), cookieDomain({ SITE_URL: 'http://127.0.0.1' }), cookieDomain({ SITE_URL: 'http://[::1]/' }), cookieDomain({})]).toEqual([null, null, null, null]);
  });

  it('Consent Mode v2 values and safe defaults script', async () => {
    const { state } = await recordConsent({ choices: { marketing: true } });
    expect(consentModeValues(state)).toMatchObject({ ad_storage: 'granted', ad_user_data: 'granted', analytics_storage: 'denied' });
    expect(consentModeDefaultsScript(getConsent(null))).toContain(`"ad_storage":"denied"`);
    expect(consentModeDefaultsScript(getConsent(null))).not.toContain('<');
  });
});

describe('HTTP and components', () => {
  it('POST stores the decision, GET returns it, invalid bodies are rejected', async () => {
    const app = new Hono().route('/api/consent', consentRoutes({ cookiesByCategory: { marketing: ['_fbp'] } }));
    const res = await app.request('https://shop.test/api/consent', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ analytics: true, marketing: false }) });
    expect(res.status).toBe(200);
    const cookies = res.headers.getSetCookie();
    expect(cookies[0]).toContain('Secure');
    expect(cookies).toContain('_fbp=; Path=/; Max-Age=0');
    const state = (await (await app.request('/api/consent', { headers: { cookie: cookieOf(cookies[0]!) } })).json()) as { choices: { analytics: boolean } };
    expect(state.choices.analytics).toBe(true);
    expect((await app.request('/api/consent', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ analytics: 'yes' }) })).status).toBe(400);
  });

  it('POST rejects cross-site requests and non-JSON bodies (CSRF)', async () => {
    const app = new Hono().route('/api/consent', consentRoutes());
    const all = JSON.stringify({ analytics: true, marketing: true, preferences: true });
    const post = (headers: Record<string, string>) => app.request('https://shop.test/api/consent', { method: 'POST', headers, body: all });
    // Un <form enctype="text/plain"> de otro sitio no dispara preflight: debe fallar sin fijar la cookie.
    const forged = await post({ 'content-type': 'text/plain', origin: 'https://evil.test', 'sec-fetch-site': 'cross-site' });
    expect([forged.status, forged.headers.getSetCookie()]).toEqual([403, []]);
    expect((await post({ 'content-type': 'text/plain' })).status).toBe(415);
    expect((await post({ 'content-type': 'application/json', origin: 'https://evil.test' })).status).toBe(403);
    expect((await post({ 'content-type': 'application/json', origin: 'null' })).status).toBe(403);
    expect((await post({ 'content-type': 'application/json', 'sec-fetch-site': 'cross-site' })).status).toBe(403);
    expect((await post({ 'content-type': 'application/json; charset=utf-8', origin: 'https://shop.test', 'sec-fetch-site': 'same-origin' })).status).toBe(200);
  });

  it('ConsentGate renders the fallback until consent is known (no third-party markup on the server)', () => {
    const html = renderToStaticMarkup(createElement(ConsentGate, { category: 'marketing', fallback: createElement('span', null, 'off') }, createElement('script', { src: 'https://connect.facebook.net/x.js' })));
    expect(html).toBe('<span>off</span>');
  });
});
