// @core/consent — API pública del servidor. Componentes de cliente en `./react.js` (ConsentBanner, ConsentGate).
export {
  CATEGORIES,
  type Category,
  CONSENT_COOKIE,
  ChoicesInput,
  type ConsentState,
  consentHistory,
  consentModeDefaultsScript,
  consentModeValues,
  cookieDomain,
  getConsent,
  hasConsent,
  policyVersion,
  recordConsent,
} from './consent.ts';
export { consentRecords } from './schema.ts';
