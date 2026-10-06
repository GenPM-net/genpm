// @core/email — API pública: `sendEmail('welcome', { to, props })`.
export {
  consoleProvider,
  defaultProvider,
  type EmailMessage,
  type EmailProvider,
  resendProvider,
  type SendResult,
  smtpProvider,
} from './providers.ts';
export { getEmailProvider, renderEmail, sendEmail, setEmailProvider, type TemplateName, type TemplateProps, templates } from './send.ts';
