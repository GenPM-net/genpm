// `.env.example` (architecture §7.6, INV-6): bloque gestionado con NOMBRES vacíos. GenPM nunca lee ni escribe `.env`.

import { upsertBlock } from './blocks.js';

export const ENV_EXAMPLE = '.env.example';

export function envBlockBody(byPackage: Array<{ n: string; e: readonly string[] }>): string | null {
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const p of [...byPackage].sort((a, b) => a.n.localeCompare(b.n))) {
    const vars = p.e.filter((v) => !seen.has(v));
    if (!vars.length) continue;
    lines.push(`# ${p.n}`);
    for (const v of vars) {
      seen.add(v);
      lines.push(`${v}=`);
    }
  }
  return lines.length ? lines.join('\n') : null;
}

export function updateEnvExample(
  current: string | null,
  byPackage: Array<{ n: string; e: readonly string[] }>,
): string {
  return upsertBlock(current, 'env', envBlockBody(byPackage), 'hash');
}
