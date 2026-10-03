// Propuesta de dependencias npm (architecture §7.6): GenPM nunca instala npm por sí mismo; propone el comando
// del package manager detectado y lo ejecuta solo con consentimiento (INV-5). Rangos ya declarados se omiten.

import type { PackageManager } from '../detect.js';

export function missingDeps(wanted: Record<string, string>, declared: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, range] of Object.entries(wanted).sort(([a], [b]) => a.localeCompare(b))) {
    if (declared[name] === undefined) out[name] = range;
  }
  return out;
}

export function installArgs(pm: PackageManager, deps: Record<string, string>): string[] {
  const specs = Object.entries(deps).map(([n, r]) => `${n}@${r}`);
  if (pm === 'npm') return ['install', ...specs];
  return ['add', ...specs];
}

export function installCommand(pm: PackageManager | null, deps: Record<string, string>): string | null {
  if (!Object.keys(deps).length) return null;
  const manager = pm ?? 'npm';
  return [manager, ...installArgs(manager, deps)].join(' ');
}
