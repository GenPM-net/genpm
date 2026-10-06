import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import * as authSchema from '../auth/schema.js';
import { addLine, carts, computeTotals, getOrCreateCart, setCartMeta, setDiscountCodes } from '../cart/index.js';
import * as cartSchema from '../cart/schema.js';
import { createProduct, getProduct, upsertCategory } from '../catalog/index.js';
import * as catalogSchema from '../catalog/schema.js';
import type { AdminContext } from '../contracts/index.js';
import { testDb } from '../db/__fixtures__/pglite.js';
import type { Db } from '../db/index.js';
import { setEmailProvider } from '../email/index.js';
import { runDue } from '../jobs/index.js';
import * as jobsSchema from '../jobs/schema.js';
import { createOrder } from '../orders/index.js';
import * as ordersSchema from '../orders/schema.js';
import { upsertRate, upsertZone } from '../shipping/index.js';
import * as shippingSchema from '../shipping/schema.js';
import * as schema from './schema.js';
import { discountRedemptions, discountsAdminResource, upsertDiscount } from './index.js';

let db: Db;
let mug: string;
let plate: string;

beforeEach(async () => {
  db = await testDb(authSchema, catalogSchema, cartSchema, ordersSchema, jobsSchema, shippingSchema, schema);
  Object.assign(process.env, { CART_COOKIE_SECRET: 'c'.repeat(40), STORE_CURRENCY: 'EUR', ORDER_LINK_SECRET: 'o'.repeat(40), SITE_URL: 'https://s.test', EMAIL_FROM: 's@s.test' });
  setEmailProvider({ name: 't', send: async () => ({ id: null }) });
  await upsertCategory({ slug: 'kitchen', name: 'Kitchen' });
  await createProduct({ slug: 'mug', name: 'Mug', status: 'active', categories: ['kitchen'], variants: [{ price: 1500, stock: 100 }] });
  await createProduct({ slug: 'plate', name: 'Plate', status: 'active', variants: [{ price: 1000, stock: 100 }] });
  mug = (await getProduct('mug'))!.variants[0]!.id;
  plate = (await getProduct('plate'))!.variants[0]!.id;
  const es = await upsertZone({ name: 'ES', countries: ['ES'] });
  await upsertRate({ zoneId: es.id, name: 'Standard', amount: 499 });
});

async function totals(codes: string[] = [], opts: { email?: string; meta?: Record<string, string> } = {}) {
  const { cart } = await getOrCreateCart(null, null);
  await addLine(cart.id, mug, 2);
  await addLine(cart.id, plate, 1);
  await setDiscountCodes(cart.id, codes);
  if (opts.meta) await setCartMeta(cart.id, opts.meta);
  const [fresh] = await db.select().from(carts).where(eq(carts.id, cart.id));
  return computeTotals(fresh!, { email: opts.email });
}

describe('applying discounts', () => {
  it('percent codes are allocated to lines; unknown and inactive codes report issues', async () => {
    await upsertDiscount({ code: 'ten', name: '10% off', type: 'percent', value: 10 });
    await upsertDiscount({ code: 'OLD', name: 'Expired', type: 'percent', value: 50, endsAt: new Date(Date.now() - 1000) });
    const t = await totals(['TEN', 'OLD', 'NOPE']);
    expect([t.subtotal.amount, t.discountTotal.amount, t.total.amount]).toEqual([4000, 400, 3600]);
    expect(t.lines.map((l) => l.discount.amount)).toEqual([300, 100]);
    expect(t.discounts).toEqual([{ source: 'discounts', label: '10% off', amount: { amount: 400, currency: 'EUR' }, code: 'TEN' }]);
    expect(t.issues.map((i) => i.message).sort()).toEqual(['Code NOPE is not valid', 'This code is not active']);
  });

  it('respects minimum order, scope by category and caps fixed amounts', async () => {
    await upsertDiscount({ code: 'BIG', name: 'Big', type: 'fixed', value: 1000, minSubtotal: 5000 });
    await upsertDiscount({ code: 'KITCHEN', name: 'Kitchen 50%', type: 'percent', value: 50, categorySlugs: ['kitchen'] });
    expect((await totals(['BIG'])).issues[0]!.message).toBe('Minimum order not reached');
    const k = await totals(['KITCHEN']);
    expect(k.lines.map((l) => [l.name, l.discount.amount])).toEqual([['Mug', 1500], ['Plate', 0]]);
    await upsertDiscount({ code: 'HUGE', name: 'Huge', type: 'fixed', value: 99_999, productSlugs: ['plate'] });
    expect((await totals(['HUGE'])).discountTotal.amount).toBe(1000);
  });

  it('non-combinable codes compete (best wins); combinable and automatic ones stack', async () => {
    await upsertDiscount({ code: 'FIVE', name: '5 off', type: 'fixed', value: 500 });
    await upsertDiscount({ code: 'TWENTY', name: '20%', type: 'percent', value: 20 });
    await upsertDiscount({ name: 'Autumn', type: 'fixed', value: 100, combinable: true });
    const t = await totals(['FIVE', 'TWENTY']);
    expect(t.discounts.map((d) => [d.label, d.amount.amount])).toEqual([['Autumn', 100], ['20%', 780]]);
    expect(t.total.amount).toBe(3120);
  });

  it('free shipping zeroes the shipping chosen by @core/shipping', async () => {
    await upsertDiscount({ code: 'SHIPFREE', name: 'Free shipping', type: 'free_shipping' });
    const plain = await totals([], { meta: { country: 'ES' } });
    expect(plain.shipping?.amount.amount).toBe(499);
    const free = await totals(['SHIPFREE'], { meta: { country: 'ES' } });
    expect([free.shipping?.amount.amount, free.total.amount]).toEqual([0, 4000]);
  });
});

describe('limits', () => {
  async function paidOrderWith(code: string, email: string) {
    await createOrder({
      email,
      currency: 'EUR',
      lines: [{ variantId: plate, productId: null, sku: null, name: 'Plate', title: '', kind: 'physical', quantity: 1, unitPrice: 1000, discount: 100 }],
      discounts: [{ source: 'discounts', label: code, amount: 100, code }],
      payment: { provider: 'manual', ref: 'x', status: 'paid' },
    });
    await runDue();
  }

  it('records redemptions when orders are paid and enforces total and per-customer limits', async () => {
    const d = await upsertDiscount({ code: 'ONCE', name: 'Once', type: 'percent', value: 10, perCustomerLimit: 1, usageLimit: 2 });
    await paidOrderWith('ONCE', 'a@x.test');
    expect(await db.select().from(discountRedemptions).where(eq(discountRedemptions.discountId, d.id))).toHaveLength(1);
    expect((await totals(['ONCE'], { email: 'A@x.test' })).issues[0]!.message).toBe('You have already used this code');
    expect((await totals(['ONCE'], { email: 'b@x.test' })).discountTotal.amount).toBe(400);
    await paidOrderWith('ONCE', 'b@x.test');
    expect((await totals(['ONCE'], { email: 'c@x.test' })).issues[0]!.message).toBe('This code has been used up');
  });

  it('first-order codes need an identity and no previous paid orders', async () => {
    await upsertDiscount({ code: 'WELCOME', name: 'Welcome', type: 'percent', value: 15, firstOrderOnly: true });
    expect((await totals(['WELCOME'])).issues[0]!.message).toMatch(/Sign in or enter your email/);
    expect((await totals(['WELCOME'], { email: 'new@x.test' })).discountTotal.amount).toBe(600);
    await paidOrderWith('OTHER', 'old@x.test');
    expect((await totals(['WELCOME'], { email: 'old@x.test' })).issues[0]!.message).toBe('This code is only for first orders');
  });

  it('validates input and admin permissions', async () => {
    await expect(upsertDiscount({ code: 'x y', name: 'n', type: 'percent', value: 10 })).rejects.toThrow();
    await expect(upsertDiscount({ code: 'P', name: 'n', type: 'percent', value: 150 })).rejects.toThrow();
    const ctx = (perms: string[]): AdminContext => ({ user: { id: 'u', email: null, name: null }, can: async (p) => perms.includes(p) });
    const row = await discountsAdminResource.create!({ code: 'admin', name: 'Admin', type: 'fixed', value: 200 }, ctx(['discounts:update']));
    expect(row).toMatchObject({ code: 'ADMIN', uses: 0 });
    await expect(discountsAdminResource.list({ page: 1, pageSize: 10 }, ctx([]))).rejects.toThrow(/forbidden/);
  });
});
