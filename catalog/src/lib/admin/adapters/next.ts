// Adaptador Next.js (App Router), en `app/api/admin/[...path]/route.ts`:
//   import { admin } from '@/genpm/admin';
//   export const { GET, POST, PUT, DELETE } = adminRouteHandlers(admin);
//   export const dynamic = 'force-dynamic';
import type { AdminConfig } from '../config.ts';
import { type AdminApiOptions, handleAdminApi } from '../server.ts';

export function adminRouteHandlers(admin: AdminConfig, opts: AdminApiOptions = {}) {
  const handler = (req: Request) => handleAdminApi(req, admin, opts);
  return { GET: handler, POST: handler, PUT: handler, DELETE: handler };
}
