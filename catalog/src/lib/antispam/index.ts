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
} from './checks.ts';
export { pruneRateLimits, type RateLimitResult, rateLimit } from './rate-limit.ts';
export { rateLimits } from './schema.ts';
export { type HumanCheckFailure, type HumanCheckOptions, type HumanCheckResult, verifyHuman } from './verify.ts';
