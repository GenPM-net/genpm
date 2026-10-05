// Control de acceso de los registros privados (V10-01, api-spec §5.4). Un registro privado no existe para quien no es
// miembro (404, nunca 403). Rol en el registro = el mayor de: fila propia o de una de sus orgs en registry_members, y
// su rol en la org dueña (owner/admin ⇒ admin, publisher ⇒ publisher, resto ⇒ reader).

export type RegistryRole = 'admin' | 'publisher' | 'reader';
export type PackagePermission = 'admin' | 'write' | 'read';

const RANK: Record<string, number> = { reader: 1, read: 1, publisher: 2, write: 2, admin: 3 };

export function atLeast(have: string | null | undefined, need: RegistryRole | PackagePermission): boolean {
  return !!have && (RANK[have] ?? 0) >= (RANK[need] ?? 99);
}

function max<T extends string>(roles: T[]): T | null {
  return roles.reduce<T | null>((best, r) => ((RANK[r] ?? 0) > (RANK[best ?? ''] ?? 0) ? r : best), null);
}

export async function registryRole(
  db: D1Database,
  registry: { id: string; owner_id: string | null },
  accountId: string,
): Promise<RegistryRole | null> {
  if (registry.owner_id === accountId) return 'admin';
  const { results } = await db
    .prepare(
      `SELECT role FROM registry_members WHERE registry_id = ?1
         AND (account_id = ?2 OR account_id IN (SELECT org_id FROM memberships WHERE user_id = ?2))
       UNION ALL
       SELECT CASE role WHEN 'owner' THEN 'admin' WHEN 'admin' THEN 'admin' WHEN 'publisher' THEN 'publisher' ELSE 'reader' END
       FROM memberships WHERE org_id = ?3 AND user_id = ?2`,
    )
    .bind(registry.id, accountId, registry.owner_id ?? '')
    .all<{ role: RegistryRole }>();
  return max(results.map((r) => r.role));
}

/** La cuenta y sus equipos: los principales que pueden tener grants. */
export async function principalsOf(db: D1Database, accountId: string): Promise<string[]> {
  const { results } = await db
    .prepare('SELECT team_id FROM team_members WHERE user_id = ?1')
    .bind(accountId)
    .all<{ team_id: string }>();
  return [accountId, ...results.map((r) => r.team_id)];
}

/** Mayor permiso explícito sobre un paquete para la cuenta o alguno de sus equipos. */
export async function grantOf(
  db: D1Database,
  packageId: string,
  principals: string[],
): Promise<PackagePermission | null> {
  const { results } = await db
    .prepare(
      'SELECT permission FROM package_grants WHERE package_id = ?1 AND principal_id IN (SELECT value FROM json_each(?2))',
    )
    .bind(packageId, JSON.stringify(principals))
    .all<{ permission: PackagePermission }>();
  return max(results.map((r) => r.permission));
}

/** Ids de paquetes con algún grant para estos principales (lecturas por lote). */
export async function grantedIds(db: D1Database, ids: string[], principals: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const { results } = await db
    .prepare(
      `SELECT DISTINCT package_id FROM package_grants WHERE package_id IN (SELECT value FROM json_each(?1))
         AND principal_id IN (SELECT value FROM json_each(?2))`,
    )
    .bind(JSON.stringify(ids), JSON.stringify(principals))
    .all<{ package_id: string }>();
  return new Set(results.map((r) => r.package_id));
}
