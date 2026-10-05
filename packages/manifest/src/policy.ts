// Políticas de organización (ENT-03): qué se puede instalar en sus proyectos. Puro: lo evalúan el registry (publicar
// en el registro privado) y el CLI/MCP (cualquier `genpm add`/`update`, también de paquetes públicos o `gh:`).

import { z } from 'zod';

export const PolicySchema = z.strictObject({
  /** Paquetes permitidos: `@scope/*`, `@scope/name` o `*`. Vacío o ausente = todos. */
  allow: z
    .array(z.string().regex(/^(\*|@[a-z0-9][a-z0-9-]*\/(\*|[a-z0-9][a-z0-9-]*))$/))
    .max(500)
    .optional(),
  /** Solo versiones con el escaneo del registry en `passed` (no `pending`). */
  requireScan: z.boolean().optional(),
  /** Licencias SPDX prohibidas (p. ej. `AGPL-3.0`). */
  denyLicenses: z.array(z.string().min(1).max(64)).max(100).optional(),
  /** Permitir instalar directamente desde Git (`gh:owner/repo#ref`), sin pasar por el registry. Por defecto, sí. */
  allowDirect: z.boolean().optional(),
});

export type Policy = z.infer<typeof PolicySchema>;

/** Motivo por el que la política rechaza el paquete, o null si lo permite. */
export function policyViolation(
  policy: Policy,
  pkg: { n: string; l?: string | null; scan?: string | null; direct?: boolean },
): string | null {
  if (pkg.direct && policy.allowDirect === false) return 'direct Git installs are not allowed';
  if (policy.allow?.length) {
    const scope = pkg.n.split('/')[0];
    const ok = policy.allow.some((p) => p === '*' || p === pkg.n || p === `${scope}/*`);
    if (!ok) return 'not in the allowed packages';
  }
  if (policy.requireScan && !pkg.direct && pkg.scan !== 'passed') return `security scan is ${pkg.scan ?? 'missing'}`;
  if (policy.requireScan && pkg.direct) return 'direct Git installs have no security scan';
  const license = pkg.l?.toUpperCase();
  if (license && policy.denyLicenses?.some((d) => d.toUpperCase() === license))
    return `license ${pkg.l} is not allowed`;
  return null;
}
