// Adaptador Hono: `app.route('/api/forms', formRoutes())` → POST /api/forms/:key (form-data o JSON).
import { Hono } from 'hono';
import { handleFormPost } from './http.ts';

export function formRoutes() {
  return new Hono().post('/:key', (c) => handleFormPost(c.req.raw, c.req.param('key')));
}
