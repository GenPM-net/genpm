// @core/cart — API pública. Importa desde aquí; endpoints en adapters/hono.ts y adapters/next.ts.
export {
  addLine,
  CartError,
  cartLineCount,
  clearCart,
  computeTotals,
  getCart,
  getOrCreateCart,
  MAX_LINES,
  MAX_QTY,
  pruneCarts,
  setCartMeta,
  setDiscountCodes,
  setLine,
} from './cart.ts';
export { CART_COOKIE, cartCookie, cartIdFromCookie, clearCartCookie } from './cookie.ts';
export { type Cart, cartLines, carts } from './schema.ts';
export {
  type Adjustment,
  applyOrderDiscount,
  type CartTotals,
  clearTotalsSteps,
  registerTotalsStep,
  type TotalsLine,
  type TotalsStep,
} from './totals.ts';
