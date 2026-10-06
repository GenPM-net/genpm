import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  consoleProvider,
  defaultProvider,
  type EmailMessage,
  renderEmail,
  resendProvider,
  sendEmail,
  setEmailProvider,
} from './index.ts';

const realFetch = globalThis.fetch;
let sent: EmailMessage[];

beforeEach(() => {
  sent = [];
  process.env.EMAIL_FROM = 'App <hello@example.com>';
  setEmailProvider({ name: 'memory', send: async (m) => (sent.push(m), { id: 'm1' }) });
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('templates', () => {
  it('render HTML and plain text', async () => {
    const w = await renderEmail('welcome', { name: 'Ada', appUrl: 'https://app.test' });
    expect(w.subject).toBe('Welcome, Ada!');
    expect(w.html).toContain('href="https://app.test"');
    expect(w.text).toContain('Your account is ready');
    const m = await renderEmail('magicLink', { url: 'https://app.test/login?t=abc', expiresInMinutes: 15 });
    expect(m.html).toContain('https://app.test/login?t=abc');
    expect(m.text).toContain('15 minutes');
    const r = await renderEmail('receipt', {
      number: 'R-1',
      currency: 'USD',
      date: new Date('2026-10-03T00:00:00Z'),
      items: [{ description: 'Pro plan', amount: 1900 }, { description: 'Seat', amount: 500 }],
    });
    expect(r.text).toContain('$24.00');
    expect(r.subject).toBe('Receipt R-1');
  });
  it('escapes user content', async () => {
    const w = await renderEmail('welcome', { name: '<script>x</script>', appUrl: 'https://a' });
    expect(w.html).not.toContain('<script>x</script>');
  });
});

describe('sendEmail', () => {
  it('sends through the configured provider with EMAIL_FROM', async () => {
    expect(await sendEmail('welcome', { to: 'ada@x.dev', props: { name: null, appUrl: 'https://a' } })).toEqual({ id: 'm1' });
    expect(sent[0]).toMatchObject({ from: 'App <hello@example.com>', to: 'ada@x.dev', subject: 'Welcome!' });
    delete process.env.EMAIL_FROM;
    await expect(sendEmail('welcome', { to: 'a@x.dev', props: { name: null, appUrl: 'https://a' } })).rejects.toThrow(/EMAIL_FROM/);
  });
});

describe('providers', () => {
  it('picks console in dev, Resend with a key, and refuses to drop mail in production', () => {
    expect(defaultProvider({ NODE_ENV: 'development' }).name).toBe('console');
    expect(defaultProvider({ RESEND_API_KEY: 're_x' }).name).toBe('resend');
    expect(() => defaultProvider({ NODE_ENV: 'production' })).toThrow(/production/);
  });
  it('console provider prints instead of sending', async () => {
    const lines: string[] = [];
    await consoleProvider((l) => lines.push(l)).send({ from: 'a', to: ['b@x', 'c@x'], subject: 'Hi', html: '', text: 'body' });
    expect(lines[0]).toContain('to=b@x,c@x');
    expect(lines[0]).toContain('body');
  });
  it('Resend provider calls the API and surfaces errors', async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), body: JSON.parse(String(init?.body)) });
      return calls.length === 1
        ? Response.json({ id: 'email_1' })
        : Response.json({ name: 'validation_error', message: 'Invalid from', statusCode: 422 }, { status: 422 });
    }) as typeof fetch;
    const p = resendProvider('re_test');
    const msg = { from: 'a@x', to: 'b@x', subject: 'S', html: '<p>h</p>', text: 'h' };
    expect(await p.send(msg)).toEqual({ id: 'email_1' });
    expect(calls[0]!.url).toBe('https://api.resend.com/emails');
    expect(calls[0]!.body).toMatchObject({ from: 'a@x', to: 'b@x', subject: 'S' });
    await expect(p.send(msg)).rejects.toThrow(/Invalid from/);
  });
});
