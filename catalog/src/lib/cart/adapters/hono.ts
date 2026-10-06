// Adaptador Hono: `app.route('/api/cart', cartRoutes({ currentUserId }))`.
import { Hono } from 'hono';
import { type CurrentUserId, cartHandlers } from './http.ts';

export function cartRoutes(opts: { currentUserId: CurrentUserId }) {
  const h = cartHandlers(opts.currentUserId);
  return new Hono()
    .get('/', (c) => h.get(c.req.raw))
    .post('/lines', (c) => h.add(c.req.raw))
    .put('/lines/:variantId', (c) => h.setQuantity(c.req.raw, c.req.param('variantId')))
    .put('/codes', (c) => h.setCodes(c.req.raw));
}
