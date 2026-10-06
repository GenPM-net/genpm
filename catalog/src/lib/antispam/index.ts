// @core/antispam — API pública. Importa desde aquí.
export {
  CAPTCHA_FIELD,
  type CaptchaConfig,
  type CaptchaProvider,
  captchaFromEnv,
  checkFormTiming,
  clientIp,
  formTimingToken,
  HONEYPOT_FIELD,
  honeypotProps,
  isHoneypotFilled,
  TIMING_FIELD,
  verifyCaptcha,
} from './checks.js';
export { pruneRateLimits, type RateLimitResult, rateLimit } from './rate-limit.js';
export { rateLimits } from './schema.js';
export { type HumanCheckFailure, type HumanCheckOptions, type HumanCheckResult, verifyHuman } from './verify.js';
