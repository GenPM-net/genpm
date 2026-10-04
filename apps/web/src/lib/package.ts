// Carga de datos de la página de paquete: metadatos del registry + README, reglas y árbol desde GitHub por SHA.
import { estimateTokens, normalizeMcp } from '@genpm/manifest';
import { injectedTree, rawFile, type TreeFile } from './github.js';
import { type LongManifest, type PackageResponse, registryGet, type VersionRow } from './registry.js';

export type PackageView = {
  pkg: PackageResponse;
  manifest: LongManifest;
  versions: VersionRow[];
  selected: VersionRow | null;
  readme: string | null | undefined;
  rules: string | null | undefined;
  tree: TreeFile[] | undefined;
  mcp: Array<{ n: string; command: string; env: string[] }>;
  rulesTokens: number | null;
  stale: boolean;
};

export async function loadPackage(
  name: string,
  version: string | null,
  locale: string,
): Promise<PackageView | null | 'quarantined' | 'unavailable'> {
  const [pkgRes, versRes] = await Promise.all([
    registryGet<PackageResponse>(`/v1/packages/${name}`, locale),
    registryGet<{ versions: VersionRow[] }>(`/v1/packages/${name}/versions?limit=50`, locale),
  ]);
  if (pkgRes.status === 451) return 'quarantined';
  const pkg = pkgRes.data;
  if (!pkg) return pkgRes.status === 404 ? null : 'unavailable';
  let manifest = pkg.latest;
  if (version && version !== manifest?.version) {
    const v = await registryGet<LongManifest>(`/v1/packages/${name}/versions/${version}`, locale);
    if (v.data) manifest = v.data;
  }
  if (!manifest) return null;
  const versions = versRes.data?.versions ?? [];
  const selected = versions.find((v) => v.v === manifest.version) ?? null;
  const base = manifest.include === '.' ? '' : `${manifest.include}/`;
  const [readme, rules, tree] = await Promise.all([
    rawFile(manifest.repo, manifest.commit, `${base}README.md`),
    rawFile(manifest.repo, manifest.commit, `${base}${manifest.context}`),
    injectedTree(manifest.repo, manifest.commit, manifest.include),
  ]);
  const rulesText = typeof rules === 'string' ? rules : pkg.contextPreview;
  return {
    pkg,
    manifest,
    versions,
    selected,
    readme,
    rules: typeof rules === 'string' ? rules : rules === undefined ? (pkg.contextPreview ?? undefined) : null,
    tree,
    mcp: manifest.mcp.map((m) => {
      const s = normalizeMcp(m as never);
      return { n: s.n, command: s.u ?? [s.c, ...(s.a ?? [])].join(' '), env: s.e ?? [] };
    }),
    rulesTokens: rulesText ? estimateTokens(rulesText) : null,
    stale: pkgRes.stale,
  };
}
