// Prueba de humo de la app completa: los 5 módulos de genpm montados juntos sobre PGlite (sin servicios externos).
import { simulateReadableStream } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import Stripe from 'stripe';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { initDb } from '../src/db.js';
import { setModel } from '../src/lib/ai/index.js';
import { aiUsage } from '../src/lib/ai/schema.js';
import { createSession, generateSessionToken, sessionCookie, upsertOAuthUser } from '../src/lib/auth/index.js';
import { billingCustomers, FEATURES_BY_PRICE, setStripe, syncSubscription } from '../src/lib/billing/index.js';
import { getDb } from '../src/lib/db/index.js';
import { type EmailMessage, sendEmail, setEmailProvider } from '../src/lib/email/index.js';

const app = createApp();
let cookie = '';
let userId = '';

beforeAll(async () => {
  process.env.GITHUB_CLIENT_ID = 'gh_test_id';
  process.env.GITHUB_CLIENT_SECRET = 'gh_test_secret';
  process.env.AUTH_SECRET = 'x'.repeat(32);
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  process.env.AI_MODEL = 'mock:m1';
  process.env.EMAIL_FROM = 'Example <hello@example.com>';
  await initDb('pglite:memory');
  const user = await upsertOAuthUser('github', {
    id: '42',
    email: 'ada@example.com',
    emailVerified: true,
    name: 'Ada',
    avatarUrl: null,
  });
  userId = user.id;
  const token = generateSessionToken();
  await createSession(token, user.id);
  cookie = sessionCookie(token).split(';')[0]!;
});

const get = (path: string, auth = true) => app.request(path, { headers: auth ? { cookie } : {} });

describe('genpm-example-saas', () => {
  it('health', async () => {
    expect(await (await get('/health', false)).json()).toEqual({ ok: true });
  });

  it('@core/auth: login redirects to GitHub, /api/me needs a session', async () => {
    const login = await get('/auth/login/github', false);
    expect(login.status).toBe(302);
    expect(login.headers.get('location')).toMatch(/^https:\/\/github\.com\/login\/oauth\/authorize\?/);
    expect((await get('/api/me', false)).status).toBe(401);
    const me = await get('/api/me');
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({ id: userId, email: 'ada@example.com', name: 'Ada' });
  });

  it('@core/billing: entitlement follows the synced subscription; bad webhook signatures are rejected', async () => {
    expect((await get('/api/pro')).status).toBe(402);
    FEATURES_BY_PRICE.price_pro = ['pro'];
    await getDb().insert(billingCustomers).values({ userId, stripeCustomerId: 'cus_1' });
    await syncSubscription({
      id: 'sub_1',
      customer: 'cus_1',
      status: 'active',
      cancel_at_period_end: false,
      metadata: {},
      items: { data: [{ price: { id: 'price_pro' }, current_period_end: Math.floor(Date.now() / 1000) + 86_400 }] },
    } as unknown as Stripe.Subscription);
    expect(await (await get('/api/pro')).json()).toEqual({ secret: 'pro content' });

    setStripe(new Stripe('sk_test_dummy'));
    const hook = await app.request('/billing/webhook', {
      method: 'POST',
      body: '{}',
      headers: { 'stripe-signature': 't=1,v1=bad' },
    });
    expect(hook.status).toBe(400);
  });

  it('@core/email: renders and sends the welcome template', async () => {
    const sent: EmailMessage[] = [];
    setEmailProvider({ name: 'memory', send: async (m) => (sent.push(m), { id: 'test' }) });
    await sendEmail('welcome', { to: 'ada@example.com', props: { name: 'Ada', appUrl: 'https://app.example.com' } });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.html).toContain('Ada');
    expect(sent[0]!.text.length).toBeGreaterThan(0);
  });

  it('@core/ai: streams a chat answer for a logged-in user and records usage', async () => {
    setModel(
      new MockLanguageModelV4({
        provider: 'mock',
        modelId: 'm1',
        doStream: {
          stream: simulateReadableStream({
            chunks: [
              { type: 'stream-start', warnings: [] },
              { type: 'text-start', id: 't' },
              { type: 'text-delta', id: 't', delta: 'Hello from genpm!' },
              { type: 'text-end', id: 't' },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: {
                  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
                  outputTokens: { total: 5, text: 5, reasoning: 0 },
                },
              },
            ],
          }),
        } as never,
      }),
    );
    const body = JSON.stringify({ messages: [{ id: '1', role: 'user', parts: [{ type: 'text', text: 'hi' }] }] });
    const anon = await app.request('/ai/chat', { method: 'POST', body, headers: { 'content-type': 'application/json' } });
    expect(anon.status).toBe(401);
    const res = await app.request('/ai/chat', {
      method: 'POST',
      body,
      headers: { 'content-type': 'application/json', cookie },
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Hello from genpm!');
    await expect.poll(async () => (await getDb().select().from(aiUsage)).length).toBe(1);
    const [row] = await getDb().select().from(aiUsage);
    expect(row).toMatchObject({ userId, inputTokens: 10, outputTokens: 5 });
  });
});
