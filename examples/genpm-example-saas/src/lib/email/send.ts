// sendEmail tipado por plantilla: el nombre elige las props obligatorias.
import { render, toPlainText } from '@react-email/render';
import { defaultProvider, type EmailProvider, type SendResult } from './providers.js';
import { type MagicLinkProps, magicLink } from './templates/magic-link.js';
import { type ReceiptProps, receipt } from './templates/receipt.js';
import { type WelcomeProps, welcome } from './templates/welcome.js';

export const templates = { welcome, magicLink, receipt } as const;
export type TemplateProps = { welcome: WelcomeProps; magicLink: MagicLinkProps; receipt: ReceiptProps };
export type TemplateName = keyof TemplateProps;

let provider: EmailProvider | null = null;

export function setEmailProvider(p: EmailProvider): void {
  provider = p;
}

export function getEmailProvider(): EmailProvider {
  provider ??= defaultProvider();
  return provider;
}

export async function renderEmail<K extends TemplateName>(name: K, props: TemplateProps[K]): Promise<{ subject: string; html: string; text: string }> {
  const t = templates[name] as unknown as { subject(p: TemplateProps[K]): string; render(p: TemplateProps[K]): Parameters<typeof render>[0] };
  const html = await render(t.render(props));
  return { subject: t.subject(props), html, text: toPlainText(html) };
}

export async function sendEmail<K extends TemplateName>(
  name: K,
  opts: { to: string | string[]; props: TemplateProps[K]; replyTo?: string; from?: string },
): Promise<SendResult> {
  const from = opts.from ?? process.env.EMAIL_FROM;
  if (!from) throw new Error('EMAIL_FROM is not set (e.g. "App <hello@example.com>")');
  const { subject, html, text } = await renderEmail(name, opts.props);
  return getEmailProvider().send({ from, to: opts.to, subject, html, text, ...(opts.replyTo ? { replyTo: opts.replyTo } : {}) });
}
