// Proveedores de envío. Elige con EMAIL_PROVIDER (resend | smtp | console); por defecto Resend si hay
// RESEND_API_KEY y, si no, consola (solo fuera de producción).
import { Resend } from 'resend';

export type EmailMessage = { from: string; to: string | string[]; subject: string; html: string; text: string; replyTo?: string };
export type SendResult = { id: string | null };

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<SendResult>;
}

export function resendProvider(apiKey: string = process.env.RESEND_API_KEY ?? ''): EmailProvider {
  if (!apiKey) throw new Error('RESEND_API_KEY is not set (see .env.example)');
  const client = new Resend(apiKey);
  return {
    name: 'resend',
    async send(m) {
      const { data, error } = await client.emails.send({
        from: m.from,
        to: m.to,
        subject: m.subject,
        html: m.html,
        text: m.text,
        ...(m.replyTo ? { replyTo: m.replyTo } : {}),
      });
      if (error) throw new Error(`Resend: ${error.message}`);
      return { id: data?.id ?? null };
    },
  };
}

/** SMTP con `nodemailer` (instálalo solo si lo usas): SMTP_URL=smtps://user:pass@smtp.example.com:465 */
export function smtpProvider(url: string = process.env.SMTP_URL ?? ''): EmailProvider {
  if (!url) throw new Error('SMTP_URL is not set');
  let transport: { sendMail(m: Record<string, unknown>): Promise<{ messageId?: string }> } | null = null;
  return {
    name: 'smtp',
    async send(m) {
      if (!transport) {
        const name = 'nodemailer';
        const mod = (await import(name)) as { default: { createTransport(url: string): NonNullable<typeof transport> } };
        transport = mod.default.createTransport(url);
      }
      const info = await transport.sendMail({ from: m.from, to: m.to, subject: m.subject, html: m.html, text: m.text, replyTo: m.replyTo });
      return { id: info.messageId ?? null };
    },
  };
}

/** Modo dev: imprime el correo (texto plano) en vez de enviarlo. */
export function consoleProvider(log: (line: string) => void = console.info): EmailProvider {
  return {
    name: 'console',
    async send(m) {
      log(`[email] to=${[m.to].flat().join(',')} subject=${JSON.stringify(m.subject)}\n${m.text}`);
      return { id: null };
    },
  };
}

export function defaultProvider(env: NodeJS.ProcessEnv = process.env): EmailProvider {
  const choice = env.EMAIL_PROVIDER ?? (env.RESEND_API_KEY ? 'resend' : 'console');
  if (choice === 'resend') return resendProvider(env.RESEND_API_KEY);
  if (choice === 'smtp') return smtpProvider(env.SMTP_URL);
  if (env.NODE_ENV === 'production') throw new Error('No email provider configured in production (set RESEND_API_KEY)');
  return consoleProvider();
}
