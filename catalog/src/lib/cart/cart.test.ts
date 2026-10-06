import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { upsertOAuthUser } from '../auth/index.js';
import * as authSchema from '../auth/schema.js';
import { createProduct, getProduct, productVariants } from '../catalog/index.js';
import * as catalogSchema from '../catalog/schema.js';
import { testDb } from '../db/__fixtures__/pglite.js';
import type { Db } from '../db/index.js';
import { money, percent } from '../money/index.js';
import { cartRoutes } from './adapters/hono.js';
import * as schema from './schema.js';
import {
  addLine,
  applyOrderDiscount,
  CartError,
  cartCookie,
  cartIdFromCookie,
  carts,
  clearTotalsSteps,
  computeTotals,
  getCart,
  getOrCreateCart,
  pruneCarts,
  registerTotalsStep,
  setDiscountCodes,
  setLine,
} from './index.js';

let db: Db;
let red: string;
let blue: string;
const cookieOf = (setCookie: string | null) => setCookie!.split(';')[0]!;
const code = (p: Promise<unknown>) => p.then(() => 'ok', (e) => (e instanceof CartError ? e.code : Promise.reject(e)));

beforeEach(async () => {
  db = await testDb(authSchema, catalogSchema, schema);
  Object.assign(process.env, { CART_COOKIE_SECRET: 'c'.repeat(40), STORE_CURRENCY: 'EUR', AUTH_SECRET: 'a'.repeat(40) });
  clearTotalsSteps();
  await createProduct({
    slug: 'mug', name: 'Mug', status: 'active', options: [{ name: 'Color', values: ['Red', 'Blue'] }],
    variants: [{ options: { Color: 'Red' }, price: 1000, stock: 2 }, { options: { Color: 'Blue' }, price: 1500, stock: 10 }],
  });
  const p = (await getProduct('mug'))!;
  red = p.variants[0]!.id;
  blue = p.variants[1]!.id;
});
afterEach(() => clearTotalsSteps());

describe('cookie', () => {
  it('signs the cart id and ignores tampered cookies', async () => {
    const c = await cartCookie('crt_1', true);
    expect(c).toMatch(/^cart=crt_1\.[\w-]+; Path=\/; HttpOnly; SameSite=Lax; Max-Age=2592000; Secure$/);
    expect(await cartIdFromCookie(`a=b; ${c.split(';')[0]}`)).toBe('crt_1');
    expect(await cartIdFromCookie(c.split(';')[0]!.replace('crt_1', 'crt_2'))).toBeNull();
    expect(await cartIdFromCookie('cart=nodot')).toBeNull();
  });
});

describe('lines and totals', () => {
  it('prices lines from the database and enforces stock and quantity limits', async () => {
    const { cart, setCookie } = await getOrCreateCart(null, null);
    expect(setCookie).toMatch(/^cart=/);
    await addLine(cart.id, red, 1);
    await addLine(cart.id, red, 1);
    expect(await code(addLine(cart.id, red, 1))).toBe('insufficient_stock');
    await addLine(cart.id, blue, 3);
    expect(await code(setLine(cart.id, blue, 100))).toBe('invalid');
    expect(await code(setLine(cart.id, 'var_nope', 1))).toBe('unavailable');
    let t = await computeTotals(cart);
    expect(t.lines.map((l) => [l.title, l.quantity, l.subtotal.amount])).toEqual([['Red', 2, 2000], ['Blue', 3, 4500]]);
    expect([t.subtotal.amount, t.total.amount]).toEqual([6500, 6500]);
    // El precio cambia en el catálogo: el carrito usa el nuevo; el stock baja: la cantidad se ajusta con aviso.
    await db.update(productVariants).set({ priceAmount: 1200, stock: 1 }).where(eq(productVariants.id, red));
    t = await computeTotals(cart);
    expect(t.lines[0]).toMatchObject({ quantity: 1, unitPrice: { amount: 1200 } });
    expect(t.issues).toEqual([{ code: 'quantity_reduced', message: 'Only 1 left', variantId: red }]);
    await db.update(productVariants).set({ active: false }).where(eq(productVariants.id, blue));
    t = await computeTotals(cart);
    expect(t.lines).toHaveLength(1);
    expect(t.issues.map((i) => i.code)).toContain('unavailable');
    await setLine(cart.id, red, 0);
    expect((await computeTotals(cart)).lines).toHaveLength(0);
  });

  it('runs registered steps in order and allocates order discounts across lines', async () => {
    registerTotalsStep({ name: 'shipping', order: 200, run: (t) => ({ ...t, shipping: { source: 'shipping', label: 'Standard', amount: money(499, t.currency) } }) });
    registerTotalsStep({
      name: 'discounts',
      order: 100,
      run: (t) => (t.context.discountCodes.includes('TEN') ? applyOrderDiscount(t, { source: 'discounts', code: 'TEN', label: '10%', amount: percent(t.subtotal, 10) }) : t),
    });
    const { cart } = await getOrCreateCart(null, null);
    await addLine(cart.id, red, 1);
    await addLine(cart.id, blue, 1);
    await setDiscountCodes(cart.id, [' ten ', 'TEN', 'bad code!']);
    const [fresh] = await db.select().from(carts).where(eq(carts.id, cart.id));
    expect(fresh!.discountCodes).toEqual(['TEN']);
    const t = await computeTotals(fresh!);
    expect([t.subtotal.amount, t.discountTotal.amount, t.shipping?.amount.amount, t.total.amount]).toEqual([2500, 250, 499, 2749]);
    expect(t.lines.map((l) => l.discount.amount)).toEqual([100, 150]);
    // Un descuento mayor que el subtotal no deja el total en negativo.
    const huge = applyOrderDiscount(t, { source: 'x', label: 'x', amount: money(99_999, 'EUR') });
    expect(huge.discountTotal.amount).toBe(2500);
  });
});

describe('guest to user', () => {
  it('merges the guest cart into the user cart on login, summing quantities', async () => {
    const user = await upsertOAuthUser('github', { id: '1', email: null, emailVerified: false, name: 'U', avatarUrl: null });
    const own = (await getOrCreateCart(null, user.id)).cart;
    await addLine(own.id, blue, 2);
    const guest = await getOrCreateCart(null, null);
    await addLine(guest.cart.id, blue, 1);
    await addLine(guest.cart.id, red, 1);
    const merged = (await getCart(cookieOf(guest.setCookie), user.id))!;
    expect(merged.id).toBe(own.id);
    const t = await computeTotals(merged);
    expect(t.lines.map((l) => [l.title, l.quantity]).sort()).toEqual([['Blue', 3], ['Red', 1]]);
    expect(await getCart(cookieOf(guest.setCookie), null)).toBeNull(); // el de invitado ya no existe
    const other = await upsertOAuthUser('github', { id: '2', email: null, emailVerified: false, name: 'V', avatarUrl: null });
    expect((await getCart(null, other.id))).toBeNull();
  });

  it('prunes expired carts', async () => {
    const { cart } = await getOrCreateCart(null, null);
    await db.update(carts).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(carts.id, cart.id));
    expect(await pruneCarts()).toBe(1);
  });
});

describe('HTTP', () => {
  it('creates the cart on first add, keeps it via cookie and validates input', async () => {
    const app = new Hono().route('/api/cart', cartRoutes({ currentUserId: async () => null }));
    const add = await app.request('/api/cart/lines', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ variantId: blue, quantity: 2 }) });
    expect(add.status).toBe(200);
    const cookie = cookieOf(add.headers.get('set-cookie'));
    const get = await app.request('/api/cart', { headers: { cookie } });
    expect(((await get.json()) as { total: { amount: number } }).total.amount).toBe(3000);
    const put = await app.request(`/api/cart/lines/${blue}`, { method: 'PUT', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ quantity: 50 }) });
    expect(put.status).toBe(409);
    expect((await app.request('/api/cart/lines', { method: 'POST', body: '{"quantity":"x"}', headers: { cookie } })).status).toBe(400);
    expect(((await (await app.request('/api/cart')).json()) as { lines: unknown[] }).lines).toEqual([]);
  });
});
