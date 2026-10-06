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
  getConsent,
  hasConsent,
  policyVersion,
  recordConsent,
} from './consent.js';
export { consentRecords } from './schema.js';
