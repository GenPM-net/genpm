// Resolución de rangos, dist-tags y clausura plana de dependencias `g` en el servidor (api-spec §4.2).

import { DIST_TAG_RE, isValidRange, maxSatisfying, satisfies } from '@genpm/manifest';
import type { PackageRow, Repo, VersionRow } from '../db/repo.js';
import { httpError } from '../http.js';

export type Resolved = { pkg: PackageRow; version: VersionRow; yanked: boolean };
export type Warning = { code: 'W_DEPRECATED' | 'W_YANKED'; n: string; msg: string };
export type Conflict = { n: string; ranges: Array<{ from: string; range: string }> };

const MAX_DEPTH = 5;

function installable(v: VersionRow): boolean {
  return v.status === 'active' && v.scan_status !== 'failed' && v.scan_status !== 'flagged' && v.yanked_at === null;
}

/** Elige la versión para un rango, versión exacta o dist-tag. Lanza 404/451 según corresponda. */
export async function pickVersion(repo: Repo, pkg: PackageRow, range: string): Promise<Resolved> {
  if (pkg.status === 'quarantined') throw httpError('E_QUARANTINED', { name: pkg.full_name });
  const versions = await repo.versions(pkg.id);
  const exact = versions.find((v) => v.version === range);
  if (exact) {
    // Una versión exacta se sirve aunque esté retirada (con aviso), pero nunca en cuarentena.
    if (exact.status === 'quarantined' || exact.scan_status === 'flagged' || exact.scan_status === 'failed') {
      throw httpError('E_QUARANTINED', { name: `${pkg.full_name}@${exact.version}` });
    }
    return { pkg, version: exact, yanked: exact.yanked_at !== null };
  }
  let target: string | null = null;
  if (DIST_TAG_RE.test(range) && !isValidRange(range)) {
    const tags = await repo.distTags(pkg.id);
    target = tags[range] ?? null;
  } else if (isValidRange(range)) {
    target = maxSatisfying(
      versions.filter(installable).map((v) => v.version),
      range,
    );
  } else {
    throw httpError('E_BAD_REQUEST', { detail: `range ${range}` });
  }
  const chosen = target ? versions.find((v) => v.version === target) : undefined;
  if (!chosen) {
    // ¿Existe pero solo en cuarentena? Entonces 451, no 404.
    const isTag = !isValidRange(range);
    const quarantined = versions.some(
      (v) => (v.status === 'quarantined' || v.scan_status === 'flagged') && (isTag || satisfies(v.version, range)),
    );
    if (quarantined) throw httpError('E_QUARANTINED', { name: pkg.full_name });
    throw httpError('E_NO_MATCHING_VERSION', { name: pkg.full_name, range });
  }
  if (!installable(chosen) && chosen.yanked_at === null) throw httpError('E_QUARANTINED', { name: pkg.full_name });
  return { pkg, version: chosen, yanked: chosen.yanked_at !== null };
}

type Installed = Map<string, string>;

/**
 * BFS desde la raíz acumulando rangos por nombre; por nombre, la versión más alta no retirada que satisface
 * todos los rangos (las instaladas tienen prioridad si satisfacen). Profundidad máx. 5; ciclos deduplicados.
 */
export async function resolveClosure(
  repo: Repo,
  root: Resolved,
  installed: Installed,
): Promise<{ deps: Resolved[]; warnings: Warning[] }> {
  const ranges = new Map<string, Array<{ from: string; range: string }>>();
  const chosen = new Map<string, Resolved>([[root.pkg.full_name, root]]);
  const warnings: Warning[] = [];
  let frontier: Resolved[] = [root];
  for (let depth = 0; depth < MAX_DEPTH && frontier.length; depth++) {
    const next: Resolved[] = [];
    for (const r of frontier) {
      const g = (JSON.parse(r.version.manifest) as { g?: Record<string, string> }).g ?? {};
      for (const [name, range] of Object.entries(g)) {
        const list = ranges.get(name) ?? [];
        list.push({ from: r.pkg.full_name, range });
        ranges.set(name, list);
      }
    }
    const names = [...ranges.keys()].filter((n) => n !== root.pkg.full_name);
    const pkgs = new Map((await repo.packagesByNames(names)).map((p) => [p.full_name, p]));
    for (const name of names) {
      const list = ranges.get(name)!;
      const pkg = pkgs.get(name);
      if (!pkg) throw httpError('E_NOT_FOUND', { name }, { requiredBy: list.map((l) => l.from) });
      if (pkg.status === 'quarantined') throw httpError('E_QUARANTINED', { name });
      const versions = (await repo.versions(pkg.id)).filter(installable);
      const all = list.map((l) => l.range);
      const inst = installed.get(name);
      let pick: string | null =
        inst && all.every((r) => satisfies(inst, r)) && versions.some((v) => v.version === inst) ? inst : null;
      if (!pick) {
        const candidates = versions.map((v) => v.version).filter((v) => all.every((r) => satisfies(v, r)));
        pick = candidates.length ? (maxSatisfying(candidates, '*') ?? candidates[0]!) : null;
      }
      if (!pick) {
        const conflicts: Conflict[] = [{ n: name, ranges: list }];
        const detail = list.map((l) => `${l.range} (from ${l.from})`).join(' conflicts with ');
        throw httpError('E_RANGE_UNSATISFIED', { detail: `${name}: ${detail}` }, { conflicts });
      }
      const prev = chosen.get(name);
      if (prev?.version.version === pick) continue;
      const version = versions.find((v) => v.version === pick)!;
      const res: Resolved = { pkg, version, yanked: false };
      chosen.set(name, res);
      if (pkg.is_deprecated) warnings.push({ code: 'W_DEPRECATED', n: name, msg: pkg.deprecation_msg ?? 'deprecated' });
      next.push(res);
    }
    frontier = next;
  }
  chosen.delete(root.pkg.full_name);
  return { deps: [...chosen.values()].sort((a, b) => a.pkg.full_name.localeCompare(b.pkg.full_name)), warnings };
}

export function parseInstalled(raw: string | undefined): Installed {
  const out: Installed = new Map();
  if (!raw) return out;
  for (const item of raw.split(',').slice(0, 50)) {
    const m = item.trim().match(/^(@[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*)@(.+)$/);
    if (m) out.set(m[1]!, m[2]!);
  }
  return out;
}
