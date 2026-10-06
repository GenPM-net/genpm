// Adaptador Hono: `app.route('/api/admin', adminRoutes(admin))` (la base debe coincidir con `basePath`).
import { Hono } from 'hono';
import type { AdminConfig } from '../config.js';
import { type AdminApiOptions, handleAdminApi } from '../server.js';

export function adminRoutes(admin: AdminConfig, opts: AdminApiOptions = {}) {
  return new Hono().all('*', (c) => handleAdminApi(c.req.raw, admin, opts));
}
