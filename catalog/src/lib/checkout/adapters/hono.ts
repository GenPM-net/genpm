// Adaptador Hono: `app.route('/api/checkout', checkoutRoutes({ currentUserId }))`.
import { Hono } from 'hono';
import { type CheckoutPaths, type CurrentUserId, handleCheckoutStatus, handleStartCheckout } from './http.ts';

export function checkoutRoutes(opts: { currentUserId: CurrentUserId; paths?: CheckoutPaths }) {
  const paths = opts.paths ?? { success: '/checkout/success', cancel: '/cart' };
  return new Hono().post('/', (c) => handleStartCheckout(c.req.raw, opts.currentUserId, paths)).get('/status', (c) => handleCheckoutStatus(c.req.raw));
}
