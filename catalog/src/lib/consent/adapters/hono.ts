// Adaptador Hono: `app.route('/api/consent', consentRoutes({ cookiesByCategory: { analytics: ['_ga'], marketing: ['_fbp'] } }))`.
import { Hono } from 'hono';
import { handleConsent } from './http.ts';

export function consentRoutes(opts: Parameters<typeof handleConsent>[1] = {}) {
  return new Hono().get('/', (c) => handleConsent(c.req.raw, opts)).post('/', (c) => handleConsent(c.req.raw, opts));
}
