// Recorrido completo con proveedor simulado (adaptador manual): importar → landing → compra test → pedido reenviado
// una sola vez → seguimiento → email "enviado" al cliente; y el evento purchase de servidor con consentimiento.
import type { ReactElement } from 'react';
import { renderToReadableStream } from 'react-dom/server';
import Stripe from 'stripe';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const jar = vi.hoisted(() => new Map<string, string>());
vi.mock('next/headers', () => ({
  draftMode: async () => ({ isEnabled: false, enable() {}, disable() {} }),
  cookies: async () => ({
    get: (n: string) => (jar.has(n) ? { name: n, value: jar.get(n)! } : undefined),
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    set: (n: string, v: string) => jar.set(n, v),
  }),
  headers: async () => new Headers({ 'x-forwarded-for': '198.51.100.9', 'user-agent': 'test' }),
}));

import { admin } from '@/genpm';
import { projectDb } from '@/genpm/__fixtures__/db';
import { upsertCategory } from '@/lib/catalog';
import { CONSENT_COOKIE, recordConsent } from '@/lib/consent';
import { getDb } from '@/lib/db';
import { type EmailMessage, setEmailProvider } from '@/lib/email';
import { runDue } from '@/lib/jobs';
import { getOrder, orders } from '@/lib/orders';
import { upsertPriceRule } from '@/lib/pricing';
import { upsertRate, upsertZone } from '@/lib/shipping';
import { handleStripeWebhook, setStripe } from '@/lib/stripe';
import { supplierOrders, upsertSupplier } from '@/lib/suppliers';
import { buyNow } from './_lib/actions';
import { profitSince } from './_lib/widgets';
import ProductLanding from './p/[slug]/page';

const html = async (node: Promise<unknown> | unknown) => {
  const stream = await renderToReadableStream((await node) as ReactElement);
  await stream.allReady;
  return (await new Response(stream).text()).replaceAll('<!-- -->', '');
};
async function run(action: (fd: FormData) => Promise<void>, fields: Record<string, string>): Promise<string> {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  try {
    await action(fd);
    return 'none';
  } catch (e) {
    const d = (e as { digest?: string }).digest;
    if (!d?.startsWith('NEXT_REDIRECT')) throw e;
    return d.split(';')[2]!;
  }
}
const ctx = { user: { id: 'usr_owner', email: null, name: null }, can: async () => true };
const res = (name: string) => admin.resources.find((r) => r.name === name)!;
const csv = `product_id,title,description,image_urls,option1_name,option1_value,variant_id,cost,stock,ship_min_days,ship_max_days
P1,Thermal mug,"<p>Keeps coffee hot</p>",,Color,Black,V1,6.00,40,6,10`;

const SECRET = 'whsec_drop';
let stripe: Stripe;
let session: Stripe.Checkout.SessionCreateParams | undefined;
const sent: EmailMessage[] = [];
const realFetch = globalThis.fetch;
const pixelCalls: Array<{ url: string; body: string }> = [];

beforeAll(() => {
  Object.assign(process.env, {
    AUTH_SECRET: 'a'.repeat(40),
    CONTENT_PREVIEW_SECRET: 'p'.repeat(40),
    SITE_URL: 'https://drop.test',
    ANTISPAM_SECRET: 's'.repeat(40),
    CART_COOKIE_SECRET: 'c'.repeat(40),
    ORDER_LINK_SECRET: 'o'.repeat(40),
    STORE_CURRENCY: 'EUR',
    STRIPE_WEBHOOK_SECRET: SECRET,
    EMAIL_FROM: 'Shop <shop@drop.test>',
    META_PIXEL_ID: '123456',
    META_CAPI_TOKEN: 'token',
  });
});

beforeEach(async () => {
  jar.clear();
  sent.length = 0;
  pixelCalls.length = 0;
  await projectDb();
  setEmailProvider({ name: 't', send: async (m) => (sent.push(m), { id: null }) });
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    pixelCalls.push({ url: String(url), body: String(init?.body ?? '') });
    return Response.json({ events_received: 1 });
  }) as typeof fetch;
  stripe = new Stripe('sk_test_123');
  setStripe(stripe);
  vi.spyOn(stripe.checkout.sessions, 'create').mockImplementation((async (p: Stripe.Checkout.SessionCreateParams) => {
    session = p;
    return { id: 'cs_test_drop', url: 'https://checkout.stripe.com/c/drop' };
  }) as never);
  await upsertCategory({ slug: 'mugs', name: 'Mugs' });
  await upsertPriceRule({ name: 'x2.5', markupBps: 15000 });
  const es = await upsertZone({ name: 'Spain', countries: ['ES'] });
  await upsertRate({ zoneId: es.id, name: 'Standard', amount: 0 });
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

async function paidWebhook(total: number) {
  const payload = JSON.stringify({
    id: `evt_${Math.random()}`,
    object: 'event',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_drop',
        object: 'checkout.session',
        payment_status: 'paid',
        amount_total: total,
        currency: 'eur',
        payment_intent: 'pi_drop',
        total_details: { amount_tax: 0 },
        customer_details: { name: 'Ana', phone: null },
        collected_information: { shipping_details: { name: 'Ana', address: { line1: 'Calle Mayor 1', line2: null, city: 'Valencia', postal_code: '46001', state: null, country: 'ES' } } },
      },
    },
  });
  return handleStripeWebhook(payload, stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET }));
}

describe('dropshipping end to end with a simulated supplier', () => {
  it('imports, sells from the product landing, forwards once, tracks and notifies', async () => {
    // 1. Proveedor manual + importación CSV como borrador; el equipo lo activa.
    const supplier = await upsertSupplier({ name: 'Mug Factory', adapter: 'manual', currency: 'EUR', config: { orderEmail: 'orders@factory.test', shipsFrom: 'CN' } });
    await res('suppliers').actions!.find((a) => a.name === 'import-csv')!.run(supplier.id, { csv, category: 'mugs' }, ctx);
    const products = res('products');
    const imported = (await products.list({ page: 1, pageSize: 10 }, ctx)).rows[0]!;
    expect(imported).toMatchObject({ slug: 'thermal-mug', status: 'draft' });
    const { id: _i, createdAt: _c, updatedAt: _u, ...form } = imported as Record<string, unknown>;
    await products.update!(imported.id as string, { ...form, status: 'active' }, ctx);

    // 2. Landing de producto con información de entrega real ANTES de pagar.
    const page = await html(ProductLanding({ params: Promise.resolve({ slug: 'thermal-mug' }), searchParams: Promise.resolve({}) }));
    expect(page).toContain('€15.99'); // 6,00 × 2,5 = 15,00 → precio psicológico de la regla
    expect(page).toContain('Delivery:</strong> 6–10 business days after shipping from China');
    expect(page).toContain('import VAT or duties may apply');
    expect(page).toContain('href="/returns"');

    // 3. Compra directa con consentimiento de marketing (para el evento de servidor).
    const { setCookies } = await recordConsent({ choices: { analytics: false, marketing: true, preferences: false }, action: 'banner', cookieHeader: null }, { secure: false });
    const consent = setCookies.find((c) => c.startsWith(`${CONSENT_COOKIE}=`))!.split(';')[0]!;
    jar.set(CONSENT_COOKIE, consent.slice(CONSENT_COOKIE.length + 1));
    const variantId = ((await products.get(imported.id as string, ctx)) as unknown as { variants: Array<{ id: string }> }).variants[0]!.id;
    expect(await run(buyNow, { slug: 'thermal-mug', variantId, quantity: '2', country: 'ES', email: 'ana@x.test' })).toBe('https://checkout.stripe.com/c/drop');
    const charged = session!.line_items!.reduce((s, l) => s + (l.price_data!.unit_amount ?? 0) * (l.quantity ?? 1), 0);
    expect(charged).toBe(3198);

    // 4. Stripe confirma (dos veces: el webhook duplicado no crea otro pedido ni otro reenvío).
    await paidWebhook(3198);
    await paidWebhook(3198);
    await runDue();
    const [order] = await getDb().select().from(orders);
    const all = await getDb().select().from(supplierOrders);
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ status: 'pending_approval' }); // modo aprobación por defecto

    // Evento purchase de servidor con el id del pedido (deduplicación con el navegador).
    const meta = pixelCalls.find((c) => c.url.includes('graph.facebook.com'));
    expect(JSON.parse(meta!.body).data[0]).toMatchObject({ event_name: 'Purchase', event_id: order!.id });

    // 5. Aprobación → email al proveedor (adaptador manual) → seguimiento → email "enviado" al cliente.
    const so = res('supplier-orders');
    await so.actions!.find((a) => a.name === 'approve')!.run(all[0]!.id, {}, ctx);
    await runDue();
    expect(sent.some((m) => [m.to].flat().includes('orders@factory.test') && m.text?.includes(order!.number))).toBe(true);
    await so.actions!.find((a) => a.name === 'shipped')!.run(all[0]!.id, { carrier: 'GLS', trackingNumber: 'TRK123' }, ctx);
    await runDue();
    expect((await getOrder(order!.id))!.fulfillmentStatus).toBe('fulfilled');
    expect(sent.some((m) => [m.to].flat().includes('ana@x.test') && m.text?.includes('TRK123'))).toBe(true);

    // 6. Rentabilidad: 31,98 − 12,00 de coste − comisión estimada (1,5 % + 0,25).
    const p = await profitSince(new Date(Date.now() - 3_600_000));
    expect(p).toMatchObject({ orders: 1, revenue: 3198, cost: 1200, fees: 48 + 25, profit: 3198 - 1200 - 73, unknownCost: 0 });
  });

  it('asks for a country before paying and keeps errors on the landing', async () => {
    expect(await run(buyNow, { slug: 'x', variantId: 'v', quantity: '1', country: '', email: 'a@x.test' })).toBe('/p/x?buy_error=needs_shipping#buy');
  });
});
