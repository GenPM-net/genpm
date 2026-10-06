// Adaptador Next.js: `app/api/consent/route.ts` → `export const { GET, POST } = consentRoute({ cookiesByCategory: { … } });`
import { handleConsent } from './http.ts';

export const consentRoute = (opts: Parameters<typeof handleConsent>[1] = {}) => ({ GET: (req: Request) => handleConsent(req, opts), POST: (req: Request) => handleConsent(req, opts) });
