import type { ReactElement } from 'react';
import { renderToReadableStream } from 'react-dom/server';
import Stripe from 'stripe';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Cookies de la petición: un tarro en memoria que las acciones de servidor leen y escriben.
const jar = vi.hoisted(() => new Map<string, string>());
vi.mock('next/headers', () => ({
  draftMode: async () => ({ isEnabled: false, enable() {}, disable() {} }),
  cookies: async () => ({
    get: (n: string) => (jar.has(n) ? { name: n, value: jar.get(n)! } : undefined),
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    set: (n: string, v: string, o?: { maxAge?: number }) => (o?.maxAge === 0 ? jar.delete(n) : jar.set(n, v)),
  }),
  headers: async () => new Headers({ 'x-forwarded-for': '198.51.100.7' }),
}));

import { admin, blocks } from '@/genpm';
import { RenderBlocks } from '@/lib/blocks';
import { createProduct, getProduct } from '@/lib/catalog';
import { upsertCategory } from '@/lib/catalog';
import { getEntry, seedEntry } from '@/lib/content';
import { projectDb } from '@/genpm/__fixtures__/db';
import { upsertDiscount } from '@/lib/discounts';
import { createOrder, getOrder, orderAccessToken } from '@/lib/orders';
import { upsertRate, upsertZone } from '@/lib/shipping';
import { setStripe } from '@/lib/stripe';
import { addToCart, applyCode, checkout, setShipping, updateLine } from './_lib/actions';
import { LEGAL_PAGES, legalPagesWidget, seedLegalPages } from './_lib/legal';
import CartPage from './cart/page';
import OrderPage from './orders/[number]/page';
import ProductPage from './products/[slug]/page';
import Shop from './shop/page';

const html = async (node: Promise<unknown> | unknown) => {
  const stream = await renderToReadableStream((await node) as ReactElement);
  await stream.allReady;
  // Sin los separadores <!-- --> que React pone entre textos contiguos.
  return (await new Response(stream).text()).replaceAll('<!-- -->', '');
};
/** Ejecuta una acción de servidor y devuelve a dónde redirige. */
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
const sp = (o: Record<string, string> = {}) => Promise.resolve(o);
let stripeParams: Stripe.Checkout.SessionCreateParams | undefined;
let mug: string;

beforeAll(() => {
  Object.assign(process.env, {
    AUTH_SECRET: 'a'.repeat(40),
    CONTENT_PREVIEW_SECRET: 'p'.repeat(40),
    SITE_URL: 'https://shop.test',
    ANTISPAM_SECRET: 's'.repeat(40),
    CART_COOKIE_SECRET: 'c'.repeat(40),
    ORDER_LINK_SECRET: 'o'.repeat(40),
    STORE_CURRENCY: 'EUR',
    STRIPE_WEBHOOK_SECRET: 'whsec_x',
  });
});

beforeEach(async () => {
  jar.clear();
  await projectDb();
  await seedEntry({ collection: 'site_settings', data: { name: 'Acme' } });
  await upsertCategory({ slug: 'kitchen', name: 'Kitchen' });
  await createProduct({ slug: 'mug', name: 'Mug', status: 'active', categories: ['kitchen'], variants: [{ sku: 'MUG', price: 1500, compareAt: 3000, stock: 5, weightGrams: 400 }] });
  await createProduct({ slug: 'secret', name: 'Draft product', variants: [{ price: 100, stock: 1 }] });
  mug = (await getProduct('mug'))!.variants[0]!.id;
  const es = await upsertZone({ name: 'Spain', countries: ['ES'] });
  await upsertRate({ zoneId: es.id, name: 'Standard', amount: 399, minDays: 2, maxDays: 4 });
  await upsertDiscount({ code: 'SAVE5', name: '5 off', type: 'fixed', value: 500 });
  const stripe = new Stripe('sk_test_123');
  setStripe(stripe);
  vi.spyOn(stripe.coupons, 'create').mockResolvedValue({ id: 'cpn_1' } as never);
  vi.spyOn(stripe.checkout.sessions, 'create').mockImplementation((async (p: Stripe.Checkout.SessionCreateParams) => {
    stripeParams = p;
    return { id: 'cs_test_1', url: 'https://checkout.stripe.com/c/1' };
  }) as never);
});

describe('catalog pages', () => {
  it('lists only active products and renders the product page with JSON-LD and no unverified "before" price', async () => {
    const shop = await html(Shop({ searchParams: sp() }));
    expect(shop).toContain('href="/products/mug"');
    expect(shop).not.toContain('Draft product');
    const page = await html(ProductPage({ params: Promise.resolve({ slug: 'mug' }), searchParams: sp() }));
    expect(page.match(/<h1/g)).toHaveLength(1);
    expect(page).toContain('name="variantId"');
    expect(page).not.toContain('30.00'); // compareAt no se muestra sin garantía Ómnibus
    const ld = JSON.parse(page.match(/<script type="application\/ld\+json">(.*?)<\/script>/)![1]!);
    expect(ld).toMatchObject({ '@type': 'Product', name: 'Mug', sku: 'MUG', offers: { price: '15.00', priceCurrency: 'EUR', availability: 'https://schema.org/InStock' } });
    expect(ld.aggregateRating).toBeUndefined(); // sin reseñas reales no hay valoración
  });

  it('renders the product grid block', async () => {
    const out = await html(<RenderBlocks blocks={[{ id: 'g', type: 'product-grid', data: { title: 'Bestsellers', category: 'kitchen' } }]} registry={blocks} />);
    expect(out).toContain('Bestsellers');
    expect(out).toContain('href="/products/mug"');
  });
});

describe('cart and checkout with server actions (no JavaScript needed)', () => {
  it('adds, updates, applies codes and shipping, then pays the server-computed total', async () => {
    expect(await run(addToCart, { variantId: mug, quantity: '2', from: '/products/mug' })).toBe('/cart?added=1');
    expect(jar.get('cart')).toMatch(/\./); // cookie firmada
    expect(await run(updateLine, { variantId: mug, quantity: '3' })).toBe('/cart');
    expect(await run(applyCode, { code: 'save5' })).toBe('/cart');
    expect(await run(setShipping, { country: 'es' })).toBe('/cart');
    const cart = await html(CartPage({ searchParams: sp() }));
    expect(cart).toContain('Standard — €3.99 (2–4 days)');
    expect(cart).toContain('€45.00'); // 3 × 15
    expect(cart).toContain('−€5.00');
    expect(cart).toContain('€43.99'); // 45 − 5 + 3.99

    // Un precio o cantidad manipulados en el formulario no existen: el cliente solo envía el email.
    expect(await run(checkout, { email: 'ana@x.test', price: '1', total: '1' })).toBe('https://checkout.stripe.com/c/1');
    const amounts = stripeParams!.line_items!.map((l) => (l.price_data!.unit_amount ?? 0) * (l.quantity ?? 1));
    expect(amounts.reduce((a, b) => a + b, 0)).toBe(4500);
    expect(stripeParams!.discounts).toEqual([{ coupon: 'cpn_1' }]);
  });

  it('reports stock and shipping problems back to the cart', async () => {
    expect(await run(addToCart, { variantId: mug, quantity: '99', from: '/products/mug' })).toBe('/products/mug?cart_error=insufficient_stock');
    await run(addToCart, { variantId: mug, quantity: '1', from: '/products/mug' });
    expect(await run(checkout, { email: 'ana@x.test' })).toBe('/cart?checkout_error=needs_shipping');
    expect(await html(CartPage({ searchParams: sp({ checkout_error: 'needs_shipping' }) }))).toContain('Choose your country and a shipping method first.');
  });
});

describe('orders and legal pages', () => {
  it('shows a guest order only with the signed link', async () => {
    const o = await createOrder({
      email: 'ana@x.test',
      currency: 'EUR',
      lines: [{ productId: (await getProduct('mug'))!.id, variantId: mug, name: 'Mug', title: '', sku: 'MUG', kind: 'physical', quantity: 1, unitPrice: 1500, discount: 0 }],
      shipping: { label: 'Standard', amount: 399 },
    });
    const order = (await getOrder(o.id))!;
    const params = Promise.resolve({ number: order.number });
    const ok = await html(OrderPage({ params, searchParams: sp({ token: await orderAccessToken(order) }) }));
    expect(ok).toContain(`Order ${order.number}`);
    await expect(OrderPage({ params: Promise.resolve({ number: order.number }), searchParams: sp({ token: 'forged' }) })).rejects.toMatchObject({ digest: expect.stringContaining('404') });
  });

  it('creates legal pages as drafts pending review and flags them on the dashboard', async () => {
    expect(await seedLegalPages()).toEqual(LEGAL_PAGES.map((p) => p.slug));
    expect(await seedLegalPages()).toEqual([]); // idempotente
    expect(await getEntry('pages', 'terms')).toBeNull(); // nada publicado
    const w = await legalPagesWidget.load({ user: { id: 'u', email: null, name: null }, can: async () => true });
    expect(w.rows!.map((r) => r.label).sort()).toEqual(['/cookies', '/privacy', '/returns', '/shipping', '/terms']);
  });

  it('registers store resources in the admin without name clashes', () => {
    const names = admin.resources.map((r) => r.name);
    expect(names).toEqual(expect.arrayContaining(['products', 'product-categories', 'categories', 'orders', 'shipping-zones', 'shipping-rates', 'discounts']));
    expect(new Set(names).size).toBe(names.length);
  });
});
