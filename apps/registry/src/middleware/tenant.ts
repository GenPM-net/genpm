// Tenancy (api-spec §1, INV-10): `genpm-registry: <slug>` (default `public`). El tenant se fija una vez por petición
// y la capa de datos lo exige por tipo en cada consulta.

import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../env.js';
import { httpError } from '../http.js';

export const tenant: MiddlewareHandler<AppEnv> = async (c, next) => {
  const slug = (c.req.header('genpm-registry') ?? 'public').toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,38}$/.test(slug)) throw httpError('E_BAD_REQUEST', { detail: 'genpm-registry' });
  if (slug === 'public') {
    c.set('tenant', { registryId: 'reg_public', slug });
  } else {
    const row = await c.env.DB.prepare('SELECT id FROM registries WHERE slug = ?1').bind(slug).first<{ id: string }>();
    // Un registry inexistente o privado sin acceso responde 404, no 403 (no revelar existencia).
    if (!row) throw httpError('E_NOT_FOUND', { name: slug });
    c.set('tenant', { registryId: row.id, slug });
  }
  await next();
};
