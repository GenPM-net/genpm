// Tenancy (api-spec §1, INV-10): `genpm-registry: <slug>` (default `public`). El tenant se fija una vez por petición
// y la capa de datos lo exige por tipo en cada consulta.

import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../env.js';
import { httpError } from '../http.js';
import { principalsOf, registryRole } from '../services/access.js';
import { dedicatedScript, dispatch } from '../services/dedicated.js';
import { actorFromRequest } from './auth.js';

export const tenant: MiddlewareHandler<AppEnv> = async (c, next) => {
  const slug = (c.req.header('genpm-registry') ?? 'public').toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,38}$/.test(slug)) throw httpError('E_BAD_REQUEST', { detail: 'genpm-registry' });
  // Worker dedicado (ENT-01): solo su registro; nunca el público ni otros.
  if (c.env.DEDICATED_TENANT && slug !== c.env.DEDICATED_TENANT) throw httpError('E_NOT_FOUND', { name: slug });
  if (slug !== 'public' && !c.env.DEDICATED_TENANT) {
    const script = await dedicatedScript(c.env.DB, slug);
    if (script) {
      const res = await dispatch(c.env, script, c.req.raw);
      if (!res) throw httpError('E_INTERNAL', { detail: 'dedicated registry unavailable' });
      return res;
    }
  }
  if (slug === 'public') {
    c.set('tenant', { registryId: 'reg_public', slug });
  } else {
    const row = await c.env.DB.prepare('SELECT id, owner_id, is_public FROM registries WHERE slug = ?1')
      .bind(slug)
      .first<{ id: string; owner_id: string | null; is_public: number }>();
    // Un registry inexistente o privado sin acceso responde 404, no 403 (no revelar existencia).
    if (!row) throw httpError('E_NOT_FOUND', { name: slug });
    // Login y claves no leen datos del registro: tienen que funcionar antes de tener token (sobre todo en un Worker
    // dedicado, ENT-01, cuyas cuentas viven en su propia D1).
    const open = c.req.path.startsWith('/v1/auth/') || c.req.path === '/v1/keys';
    if (row.is_public || open) {
      c.set('tenant', { registryId: row.id, slug });
    } else {
      // V10-01: solo miembros. Un token inválido sigue siendo 401; sin token o sin rol, 404.
      const actor = await actorFromRequest(c);
      const role = actor ? await registryRole(c.env.DB, row, actor.accountId) : null;
      if (!actor || !role) throw httpError('E_NOT_FOUND', { name: slug });
      c.set('actor', actor);
      c.set('tenant', {
        registryId: row.id,
        slug,
        private: { ownerId: row.owner_id, role, principals: await principalsOf(c.env.DB, actor.accountId) },
      });
    }
  }
  await next();
  // Nada de un registro privado se cachea fuera del cliente, aunque la ruta pida caché pública.
  if (c.get('tenant')?.private) c.res.headers.set('Cache-Control', 'private, no-store');
};
