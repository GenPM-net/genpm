// Adaptador Hono: `app.route('/api/comments', commentRoutes({ currentUser }))` → GET/POST /api/comments/:type/:id
import { Hono } from 'hono';
import type { Moderation } from '../index.js';
import { type CurrentUser, handleList, handlePost } from './http.js';

export function commentRoutes(opts: { currentUser: CurrentUser; moderation?: Moderation }) {
  return new Hono()
    .get('/:type/:id', (c) => handleList(c.req.raw, c.req.param('type'), c.req.param('id')))
    .post('/:type/:id', (c) => handlePost(c.req.raw, c.req.param('type'), c.req.param('id'), opts));
}
