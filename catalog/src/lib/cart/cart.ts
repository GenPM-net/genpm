// Carrito: crear/recuperar por cookie, líneas, fusión al iniciar sesión y totales calculados en servidor.
import { and, eq, inArray, lt, sql } from 'drizzle-orm';
import { availability, getVariants, storeCurrency } from '../catalog/index.js';
import { type Executor, getDb, withTransaction } from '../db/index.js';
import { money } from '../money/index.js';
import { CART_TTL_DAYS, cartCookie, cartIdFromCookie } from './cookie.js';
import { type Cart, cartLines, carts } from './schema.js';
import { type CartTotals, emptyTotals, lineSubtotal, runSteps, sumLines, type TotalsLine } from './totals.js';

export class CartError extends Error {
  constructor(
    readonly code: 'not_found' | 'invalid' | 'unavailable' | 'insufficient_stock',
    message: string = code,
  ) {
    super(message);
    this.name = 'CartError';
  }
}

export const MAX_QTY = 99;
export const MAX_LINES = 100;
const expires = () => new Date(Date.now() + CART_TTL_DAYS * 86_400_000);

async function byId(id: string, db: Executor): Promise<Cart | null> {
  const [c] = await db.select().from(carts).where(and(eq(carts.id, id), sql`${carts.expiresAt} > now()`));
  return c ?? null;
}

/**
 * Carrito de la petición: el del usuario si tiene sesión (fusionando el de invitado de la cookie) o el de la cookie.
 * No crea ninguno.
 */
export async function getCart(cookieHeader: string | null | undefined, userId: string | null, db: Executor = getDb()): Promise<Cart | null> {
  const guestId = await cartIdFromCookie(cookieHeader);
  const guest = guestId ? await byId(guestId, db) : null;
  if (!userId) return guest && !guest.userId ? guest : null;
  const [own] = await db.select().from(carts).where(and(eq(carts.userId, userId), sql`${carts.expiresAt} > now()`)).limit(1);
  if (guest && !guest.userId && guest.id !== own?.id) return mergeInto(guest, own ?? null, userId, db);
  return own ?? null;
}

/** Como `getCart`, pero crea el carrito si no existe y devuelve la cookie a fijar. */
export async function getOrCreateCart(cookieHeader: string | null | undefined, userId: string | null, db: Executor = getDb()): Promise<{ cart: Cart; setCookie: string | null }> {
  const existing = await getCart(cookieHeader, userId, db);
  if (existing) return { cart: existing, setCookie: userId ? null : await cartCookie(existing.id) };
  const [cart] = await db.insert(carts).values({ userId, currency: storeCurrency(), expiresAt: expires() }).returning();
  return { cart: cart!, setCookie: await cartCookie(cart!.id) };
}

/** El carrito de invitado pasa al usuario; si ya tenía uno, se suman las cantidades (con tope). */
async function mergeInto(guest: Cart, own: Cart | null, userId: string, db: Executor): Promise<Cart> {
  if (!own) {
    const [c] = await db.update(carts).set({ userId, expiresAt: expires() }).where(eq(carts.id, guest.id)).returning();
    return c!;
  }
  return tx(db, async (t) => {
    const lines = await t.select().from(cartLines).where(eq(cartLines.cartId, guest.id));
    for (const l of lines)
      await t
        .insert(cartLines)
        .values({ cartId: own.id, variantId: l.variantId, quantity: l.quantity })
        .onConflictDoUpdate({ target: [cartLines.cartId, cartLines.variantId], set: { quantity: sql`least(${cartLines.quantity} + ${l.quantity}, ${MAX_QTY})` } });
    const codes = [...new Set([...own.discountCodes, ...guest.discountCodes])];
    await t.delete(carts).where(eq(carts.id, guest.id));
    const [c] = await t.update(carts).set({ discountCodes: codes, expiresAt: expires() }).where(eq(carts.id, own.id)).returning();
    return c!;
  });
}

/** Fija la cantidad de una variante (0 = quitar). Comprueba que se puede vender y el stock disponible. */
export async function setLine(cartId: string, variantId: string, quantity: number, db: Executor = getDb()): Promise<void> {
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > MAX_QTY) throw new CartError('invalid', `quantity must be 0–${MAX_QTY}`);
  if (quantity === 0) {
    await db.delete(cartLines).where(and(eq(cartLines.cartId, cartId), eq(cartLines.variantId, variantId)));
    return;
  }
  const [row] = await getVariants([variantId], db);
  if (!row || !row.variant.active || row.product.status !== 'active') throw new CartError('unavailable', 'product not available');
  const v = row.variant;
  if (availability(v) === 'OutOfStock') throw new CartError('unavailable', 'out of stock');
  if (v.trackStock && !v.allowBackorder && quantity > v.stock) throw new CartError('insufficient_stock', `only ${v.stock} left`);
  const [{ n } = { n: 0 }] = await db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(cartLines).where(eq(cartLines.cartId, cartId));
  if (n >= MAX_LINES) throw new CartError('invalid', 'cart is full');
  await db
    .insert(cartLines)
    .values({ cartId, variantId, quantity })
    .onConflictDoUpdate({ target: [cartLines.cartId, cartLines.variantId], set: { quantity } });
  await db.update(carts).set({ expiresAt: expires() }).where(eq(carts.id, cartId));
}

/** Suma `quantity` a la línea existente (botón "añadir al carrito"). */
export async function addLine(cartId: string, variantId: string, quantity = 1, db: Executor = getDb()): Promise<void> {
  const [cur] = await db.select().from(cartLines).where(and(eq(cartLines.cartId, cartId), eq(cartLines.variantId, variantId)));
  await setLine(cartId, variantId, Math.min((cur?.quantity ?? 0) + quantity, MAX_QTY), db);
}

export async function setDiscountCodes(cartId: string, codes: string[], db: Executor = getDb()): Promise<void> {
  const clean = [...new Set(codes.map((c) => c.trim().toUpperCase()).filter((c) => /^[A-Z0-9_-]{2,40}$/.test(c)))].slice(0, 5);
  await db.update(carts).set({ discountCodes: clean }).where(eq(carts.id, cartId));
}

export async function setCartMeta(cartId: string, meta: Record<string, string>, db: Executor = getDb()): Promise<void> {
  const [c] = await db.select().from(carts).where(eq(carts.id, cartId));
  if (!c) throw new CartError('not_found');
  const next = { ...c.meta };
  for (const [k, v] of Object.entries(meta)) if (/^[a-z][a-zA-Z0-9_]{0,31}$/.test(k)) next[k] = String(v).slice(0, 200);
  await db.update(carts).set({ meta: next }).where(eq(carts.id, cartId));
}

/**
 * Totales con precios actuales de la base de datos. Las líneas que ya no se pueden vender se excluyen y se avisa en
 * `issues`. Después corren los pasos registrados (descuentos, envío, impuestos).
 */
export async function computeTotals(cart: Cart, opts: { email?: string } = {}, db: Executor = getDb()): Promise<CartTotals> {
  const base = emptyTotals(cart.id, cart.currency, { discountCodes: cart.discountCodes, meta: cart.meta, userId: cart.userId, ...(opts.email && { email: opts.email }) });
  const rows = await db.select().from(cartLines).where(eq(cartLines.cartId, cart.id));
  const variants = await getVariants(rows.map((r) => r.variantId), db);
  const lines: TotalsLine[] = [];
  for (const r of rows) {
    const found = variants.find((x) => x.variant.id === r.variantId);
    const v = found?.variant;
    if (!found || !v || !v.active || found.product.status !== 'active' || availability(v) === 'OutOfStock' || v.currency !== cart.currency) {
      base.issues.push({ code: 'unavailable', message: 'A product in your cart is no longer available', variantId: r.variantId });
      continue;
    }
    let quantity = r.quantity;
    if (v.trackStock && !v.allowBackorder && quantity > v.stock) {
      quantity = v.stock;
      base.issues.push({ code: 'quantity_reduced', message: `Only ${v.stock} left`, variantId: r.variantId });
    }
    lines.push({
      variantId: v.id,
      productId: found.product.id,
      slug: found.product.slug,
      name: found.product.name,
      title: v.title,
      sku: v.sku,
      mediaId: v.mediaId,
      kind: found.product.kind,
      quantity,
      unitPrice: money(v.priceAmount, v.currency),
      subtotal: lineSubtotal(v.priceAmount, quantity, v.currency),
      discount: money(0, v.currency),
      weightGrams: v.weightGrams,
    });
  }
  return runSteps({ ...base, lines, subtotal: sumLines(lines, cart.currency) });
}

export async function clearCart(cartId: string, db: Executor = getDb()): Promise<void> {
  await db.delete(cartLines).where(eq(cartLines.cartId, cartId));
  await db.update(carts).set({ discountCodes: [] }).where(eq(carts.id, cartId));
}

/** Borra carritos caducados (prográmalo a diario con @core/jobs). */
export async function pruneCarts(db: Executor = getDb()): Promise<number> {
  const rows = await db.delete(carts).where(lt(carts.expiresAt, new Date())).returning({ id: carts.id });
  return rows.length;
}

export async function cartLineCount(cartId: string, db: Executor = getDb()): Promise<number> {
  const [r] = await db.select({ n: sql<number>`coalesce(sum(${cartLines.quantity}), 0)`.mapWith(Number) }).from(cartLines).where(inArray(cartLines.cartId, [cartId]));
  return r?.n ?? 0;
}

function tx<T>(db: Executor, fn: (t: Executor) => Promise<T>): Promise<T> {
  return 'rollback' in db ? fn(db) : withTransaction((t) => fn(t), db as Parameters<typeof withTransaction>[1]);
}
