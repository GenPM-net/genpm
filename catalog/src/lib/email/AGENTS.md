# @core/email — rules for AI agents

## Purpose
Transactional email with typed templates: `sendEmail('welcome', { to, props })`. Providers: Resend (default), SMTP
(optional, via `nodemailer`) and a console provider for development. Templates use React Email. No marketing lists,
no queues, no tracking pixels.

## Map
- `index.ts` — public API: `sendEmail`, `renderEmail`, `setEmailProvider`, provider factories, `TemplateProps`.
- `send.ts` — the template registry (`templates`) and `sendEmail`.
- `templates/*.ts` — `welcome`, `magicLink`, `receipt`, plus the shared `layout.ts`.
- `providers.ts` — `EmailProvider` interface and implementations.

## Integration
1. Env: `EMAIL_FROM` (`"App <hello@yourdomain.com>"`) and `RESEND_API_KEY` (verify the domain in Resend first).
   Without `RESEND_API_KEY`, outside production, emails are printed to the console.
   `@types/react` is only needed at build time: move it to devDependencies if GenPM added it to dependencies.
   SMTP instead: `EMAIL_PROVIDER=smtp`, `SMTP_URL=smtps://user:pass@host:465` and install `nodemailer`.
2. Send from server code only:
   ```ts
   import { sendEmail } from './lib/email/index.ts';
   await sendEmail('welcome', { to: user.email, props: { name: user.name, appUrl: 'https://app.example.com' } });
   ```
3. With `@core/auth` (≥ 1.1.0): send `welcome` from its `onLogin` hook when `isNewUser` is true:
   ```ts
   app.route('/auth', authRoutes({
     onLogin: ({ user, isNewUser }) =>
       isNewUser && user.email ? sendEmail('welcome', { to: user.email, props: { name: user.name, appUrl: process.env.APP_URL ?? '' } }).then(() => undefined) : undefined,
   }));
   ```
4. Verify: run the app without `RESEND_API_KEY` and check the console output.

## Conventions
- New template: create `templates/<name>.ts` exporting `{ subject(props), render(props) }` built with
  `createElement as h` (no JSX, so it works with any `jsxImportSource`), then add it to `templates` and
  `TemplateProps` in `send.ts`. TypeScript then enforces its props everywhere.
- Amounts in minor units (cents); links absolute (`https://…`).
- Keep `sendEmail` calls out of request hot paths when possible (after the response, or in a job).

## Don't
- Don't send from the browser or expose `RESEND_API_KEY` to client code.
- Don't interpolate untrusted HTML into templates; pass plain strings (React escapes them).
- Don't log full email bodies in production (they may contain sign-in links).
