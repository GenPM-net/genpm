// POST /v1/packages/:scope/:name/versions/:version/yank (api-spec §4.6). Yank no borra (INV-9): la versión sigue
// siendo inmutable, no se puede re-publicar, `resolve` con rango la ignora y con versión exacta avisa con W_YANKED.

import { compareVersions } from '@genpm/manifest';
import { Hono } from 'hono';
import { z } from 'zod';
import { purgePackage } from '../cache.js';
import type { AppEnv } from '../env.js';
import { httpError } from '../http.js';
import { newId } from '../ids.js';
import { requireAuth, tokenAllows } from '../middleware/auth.js';
import { fullName, repoOf } from './util.js';

const Body = z.strictObject({ reason: z.string().trim().min(3).max(280) });

/** ¿Puede el actor escribir en el paquete? (owner, o rol de escritura en la org dueña; staff en scopes reservados). */
export async function canWrite(
  c: { env: AppEnv['Bindings'] },
  actor: NonNullable<AppEnv['Variables']['actor']>,
  ownerId: string,
): Promise<boolean> {
  if (ownerId === actor.accountId) return true;
  const m = await c.env.DB.prepare('SELECT role FROM memberships WHERE org_id = ?1 AND user_id = ?2')
    .bind(ownerId, actor.accountId)
    .first<{ role: string }>();
  return !!m && ['owner', 'admin', 'publisher'].includes(m.role);
}

export const yank = new Hono<AppEnv>().post(
  '/:scope{@[a-z0-9][a-z0-9-]*}/:name{[a-z0-9][a-z0-9-]*}/versions/:version{[0-9A-Za-z.+-]+}/yank',
  requireAuth('publish'),
  async (c) => {
    const actor = c.get('actor')!;
    const parsed = Body.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw httpError('E_BAD_REQUEST', { detail: 'reason' });
    const repo = repoOf(c);
    const name = fullName(c);
    const pkg = await repo.packageByName(name);
    // Sin permiso ⇒ 404, no 403: no se revela la existencia de recursos inaccesibles (security §5).
    if (!pkg || !tokenAllows(actor, name) || !(await canWrite(c, actor, pkg.owner_id)))
      throw httpError('E_NOT_FOUND', { name });
    const v = await repo.version(pkg.id, c.req.param('version'));
    if (!v) throw httpError('E_NO_MATCHING_VERSION', { name, range: c.req.param('version') });
    const now = Date.now();
    const stmts: D1PreparedStatement[] = [
      c.env.DB.prepare(
        'UPDATE package_versions SET yanked_at = coalesce(yanked_at, ?1), yank_reason = ?2 WHERE id = ?3',
      ).bind(now, parsed.data.reason, v.id),
    ];
    let latest = pkg.latest_version;
    if (pkg.latest_version_id === v.id) {
      // `latest` pasa a la siguiente versión estable no retirada.
      const candidates = (await repo.versions(pkg.id)).filter(
        (x) => x.id !== v.id && x.yanked_at === null && x.v_prerelease === null && x.status === 'active',
      );
      candidates.sort((a, b) => compareVersions(b.version, a.version));
      const next = candidates[0] ?? null;
      latest = next?.version ?? null;
      stmts.push(
        c.env.DB.prepare(
          'UPDATE packages SET latest_version_id = ?1, latest_version = ?2, updated_at = ?3 WHERE id = ?4',
        ).bind(next?.id ?? null, latest, now, pkg.id),
      );
      stmts.push(
        next
          ? c.env.DB.prepare(
              "UPDATE dist_tags SET version_id = ?1, updated_at = ?2 WHERE package_id = ?3 AND tag = 'latest'",
            ).bind(next.id, now, pkg.id)
          : c.env.DB.prepare("DELETE FROM dist_tags WHERE package_id = ?1 AND tag = 'latest'").bind(pkg.id),
      );
    }
    stmts.push(
      c.env.DB.prepare(
        "INSERT INTO audit_log (id, registry_id, actor_id, action, target_type, target_id, metadata, created_at) VALUES (?1, ?2, ?3, 'version.yank', 'version', ?4, ?5, ?6)",
      ).bind(
        newId('aud'),
        c.get('tenant').registryId,
        actor.accountId,
        v.id,
        JSON.stringify({ reason: parsed.data.reason }),
        now,
      ),
    );
    await c.env.DB.batch(stmts);
    c.executionCtx.waitUntil(purgePackage(c, name));
    return c.json({ ok: true, latest });
  },
);
