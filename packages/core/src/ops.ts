// Operaciones de consumidor sobre un proyecto (cli-mcp-spec §0, §A.5): list, remove, info, search, outdated, audit, compose.

import { readdir, readFile, rm, rmdir } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import {
  compareVersions,
  diffKind,
  GenpmError,
  normalizeMcp,
  pickSummary,
  RECIPE_SLUG_RE,
  type ResolvedManifest,
  validateRecipe,
  verifyManifest,
} from '@genpm/manifest';
import { withLock } from './busy.js';
import { loadRc, registryFor } from './config.js';
import { findRoot } from './detect.js';
import { fail } from './errors.js';
import { type FetchOptions, fetchSource, sourcePath } from './fetch/index.js';
import { readTextOrNull, writeFileAtomic } from './fs/io.js';
import { safeDestPath, safePath } from './fs/safe-path.js';
import { hasBlock, upsertBlock } from './inject/blocks.js';
import { ADAPTERS, indexBody } from './inject/context.js';
import { ENV_EXAMPLE } from './inject/env.js';
import { MCP_FILES, removeFromMcpConfig } from './inject/mcp.js';
import { keysFor } from './keys.js';
import {
  type Drift,
  driftCount,
  driftOf,
  integrityOf,
  readFilesIndex,
  readLock,
  removeFilesIndex,
  writeLock,
} from './lock.js';
import { type ClientKind, RegistryClient } from './registry-client.js';
import { revokedKeys } from './revocation.js';

export type CommonOptions = {
  cwd: string;
  registry?: string;
  token?: string | null;
  client?: ClientKind;
  telemetry?: boolean;
  fetchImpl?: typeof fetch;
  fetch?: FetchOptions;
  home?: string;
  log?: (line: string) => void;
};

async function clientFor(
  opts: CommonOptions,
  name: string | null,
): Promise<{ client: RegistryClient; registry: string }> {
  let root: string | null = null;
  try {
    root = await findRoot(opts.cwd, opts.home);
  } catch {
    root = null;
  }
  const rc = await loadRc(root, opts.home);
  const registry = registryFor(name, rc, opts.registry);
  return {
    registry,
    client: new RegistryClient({
      registry,
      token: opts.token ?? null,
      client: opts.client ?? 'cli',
      telemetry: opts.telemetry,
      fetchImpl: opts.fetchImpl,
      log: opts.log,
    }),
  };
}

/** Archivos generados por GenPM dentro de `d` que no cuentan como drift. */
const GENERATED_IN_DEST = new Set(['CLAUDE.md']);

async function listFiles(abs: string): Promise<string[]> {
  const out: string[] = [];
  const walk = async (dir: string, rel: string) => {
    let entries: import('node:fs').Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) await walk(join(dir, e.name), r);
      else if (!GENERATED_IN_DEST.has(r)) out.push(r);
    }
  };
  await walk(abs, '');
  return out;
}

// ───────────── list ─────────────

export type InstalledPackage = { n: string; v: string; c: string; d: string; drift: Drift };

export async function list(opts: Pick<CommonOptions, 'cwd' | 'home'>): Promise<InstalledPackage[]> {
  const root = await findRoot(opts.cwd, opts.home);
  const lock = await readLock(root);
  const out: InstalledPackage[] = [];
  for (const [n, e] of Object.entries(lock.p).sort(([a], [b]) => a.localeCompare(b))) {
    const index = await readFilesIndex(root, n);
    out.push({ n, v: e.v, c: e.c, d: e.d, drift: await driftOf(root, e, index, listFiles) });
  }
  return out;
}

// ───────────── remove ─────────────

export type RemoveInput = CommonOptions & { name: string; keepCode?: boolean; force?: boolean };
export type RemoveResult = {
  ok: true;
  removed: string;
  deleted: string[];
  updated: string[];
  keptCode: boolean;
  mcpServers: string[];
  next: string[];
};

export async function remove(input: RemoveInput): Promise<RemoveResult> {
  const root = await findRoot(input.cwd, input.home);
  return withLock(root, async () => {
    const lock = await readLock(root);
    const entry = lock.p[input.name];
    if (!entry) throw fail('E_NOT_FOUND', { name: input.name });
    const dependents = Object.entries(lock.p)
      .filter(([n, e]) => n !== input.name && e.g && Object.hasOwn(e.g, input.name))
      .map(([n]) => n);
    if (dependents.length)
      throw fail('E_REQUIRED_BY', { name: input.name, dependents: dependents.join(', ') }, { dependents });
    const drift = await driftOf(root, entry, await readFilesIndex(root, input.name), listFiles);
    if (driftCount(drift) > 0 && !input.force && !input.keepCode) {
      const err = fail('E_DRIFT', { name: input.name, count: driftCount(drift) }, { drift });
      // En el MCP no existe `force`: la salida segura es preguntar al usuario o conservar su código.
      if (input.client === 'mcp')
        throw new GenpmError(
          'E_DRIFT',
          err.message,
          'Ask the user; retry with keepCode:true to keep their modified code',
          err.details,
        );
      throw err;
    }
    const deleted: string[] = [];
    const updated: string[] = [];
    const ref = { n: input.name, v: entry.v, d: entry.d };
    if (!input.keepCode) {
      await rm(await safeDestPath(root, entry.d), { recursive: true, force: true });
      deleted.push(entry.d);
    }
    for (const adapter of Object.values(ADAPTERS)) {
      for (const p of adapter.packagePaths(ref)) {
        if (p.startsWith(`${entry.d}/`) && !input.keepCode) continue;
        const abs = await safePath(root, p);
        if ((await readTextOrNull(abs)) !== null) {
          await rm(abs, { force: true });
          deleted.push(p);
        }
      }
    }
    delete lock.p[input.name];
    const all = Object.entries(lock.p).map(([n, e]) => ({ n, v: e.v, d: e.d }));
    // Un archivo que solo contenía lo que añadió GenPM se borra en vez de dejarlo vacío.
    const writeOrDelete = async (rel: string, abs: string, text: string) => {
      if (text.trim() === '') {
        await rm(abs, { force: true });
        deleted.push(rel);
      } else {
        await writeFileAtomic(abs, text);
        updated.push(rel);
      }
    };
    for (const file of ['AGENTS.md', 'CLAUDE.md']) {
      const abs = await safePath(root, file);
      const current = await readTextOrNull(abs);
      if (hasBlock(current, 'index')) await writeOrDelete(file, abs, upsertBlock(current, 'index', indexBody(all)));
    }
    const envAbs = await safePath(root, ENV_EXAMPLE);
    const env = await readTextOrNull(envAbs);
    if (env?.includes(`# ${input.name}\n`)) {
      const next = env.replace(new RegExp(`# ${input.name.replace(/[/@]/g, '\\$&')}\\n(?:[A-Z][A-Z0-9_]*=\\n?)*`), '');
      const cleaned = /# genpm:env:start\n# genpm:env:end\n?/.test(next)
        ? upsertBlock(next, 'env', null, 'hash')
        : next;
      await writeOrDelete(ENV_EXAMPLE, envAbs, cleaned);
    }
    await removeFilesIndex(root, input.name);
    if (Object.keys(lock.p).length) {
      await writeLock(root, lock);
      updated.push('genpm.lock');
    } else {
      // Último paquete: sin lock ni índice vacíos (la carpeta .genpm se conserva si guarda algo más, p. ej. caché).
      await rm(await safePath(root, 'genpm.lock'), { force: true });
      deleted.push('genpm.lock');
      await rmdir(join(root, '.genpm', 'files')).catch(() => undefined);
      const rest = await readdir(join(root, '.genpm')).catch(() => [] as string[]);
      if (rest.every((f) => f === '.gitignore' || f === 'tmp' || f === '.lock'))
        await rm(join(root, '.genpm', '.gitignore'), { force: true });
    }
    let mcpServers: string[] = [];
    if (entry.m === 1) {
      try {
        const { client } = await clientFor(input, input.name);
        const v = await client.version(input.name, entry.v);
        mcpServers = (v.m ?? []).map((m) => normalizeMcp(m).n);
      } catch {
        mcpServers = [];
      }
    }
    // Los servidores MCP que GenPM añadió (con consentimiento, INV-5) se quitan con el paquete: dejarlos apuntaría a
    // un módulo que ya no está, y `genpm mcp remove` ya no podría encontrarlo.
    const mcpRemoved = new Set<string>();
    for (const target of ['claude', 'cursor', 'vscode'] as const) {
      if (!mcpServers.length) break;
      const rel = MCP_FILES[target];
      const abs = await safePath(root, rel);
      const r = removeFromMcpConfig(await readTextOrNull(abs), target, mcpServers);
      if (!r.removed.length) continue;
      for (const n of r.removed) mcpRemoved.add(n);
      const left = JSON.parse(r.text) as Record<string, Record<string, unknown> | undefined>;
      const emptyShell = Object.keys(left).length === 1 && Object.keys(Object.values(left)[0] ?? {}).length === 0;
      await writeOrDelete(rel, abs, emptyShell ? '' : r.text);
    }
    return {
      ok: true,
      removed: input.name,
      deleted,
      updated,
      keptCode: !!input.keepCode,
      mcpServers: [...mcpRemoved],
      next: [] as string[],
    };
  });
}

// ───────────── search / info ─────────────

export async function search(
  opts: CommonOptions & { query?: string; keywords?: string[]; mcp?: boolean; sort?: string; limit?: number },
) {
  const { client } = await clientFor(opts, null);
  return client.search({
    query: opts.query,
    keywords: opts.keywords,
    mcp: opts.mcp,
    sort: opts.sort,
    limit: opts.limit,
  });
}

export type PackageInfo = {
  manifest: ResolvedManifest;
  deps: ResolvedManifest[];
  rules: string;
  rulesTruncated: boolean;
  scan: string;
  versions: string[];
  installed: null | { v: string; c: string; d: string; drift: number };
};

export async function info(
  opts: CommonOptions & { name: string; range?: string; fullRules?: boolean; locale?: string },
): Promise<PackageInfo> {
  const { client, registry } = await clientFor(opts, opts.name);
  const res = await client.resolve(opts.name, opts.range ?? 'latest', { deps: true });
  const keys = keysFor(registry);
  const revoked = await revokedKeys({ registry, client });
  for (const m of [res.root, ...res.deps]) {
    if (!m.sg || !(await verifyManifest(m, m.sg, keys, revoked)).ok)
      throw fail('E_SIGNATURE', { name: `${m.n}@${m.v}` });
  }
  const { sg: _sg, ...manifest } = res.root;
  let rules = '';
  try {
    const src = await fetchSource(
      { r: manifest.r, c: manifest.c, i: manifest.i },
      { ...opts.fetch, fetchImpl: opts.fetchImpl, log: opts.log },
    );
    rules = (await readFile(sourcePath(src, manifest.i, manifest.x), 'utf8').catch(() => '')) ?? '';
  } catch {
    const long = await client.packageLong(opts.name).catch(() => null);
    rules = long?.contextPreview ?? '';
  }
  const limit = opts.fullRules ? Number.POSITIVE_INFINITY : 1500;
  let installed: PackageInfo['installed'] = null;
  try {
    const root = await findRoot(opts.cwd, opts.home);
    const lock = await readLock(root);
    const e = lock.p[opts.name];
    if (e)
      installed = {
        v: e.v,
        c: e.c,
        d: e.d,
        drift: driftCount(await driftOf(root, e, await readFilesIndex(root, opts.name))),
      };
  } catch {
    installed = null;
  }
  const pkg = await client.packageCompact(opts.name).catch(() => null);
  const s = opts.locale ? pickSummary(manifest.s, opts.locale) : undefined;
  return {
    manifest: (s === undefined ? manifest : { ...manifest, s }) as ResolvedManifest,
    deps: res.deps.map(({ sg: _s, ...d }) => d as ResolvedManifest),
    rules: rules.length > limit ? rules.slice(0, limit) : rules,
    rulesTruncated: rules.length > limit,
    scan: res.scan[opts.name] ?? 'pending',
    versions: pkg ? Object.values(pkg.dt) : [manifest.v],
    installed,
  };
}

// ───────────── outdated ─────────────

export type OutdatedEntry = {
  n: string;
  v: string;
  latest: string;
  kind: 'patch' | 'minor' | 'major' | 'prerelease';
  drift: number;
};

export async function outdated(opts: CommonOptions): Promise<OutdatedEntry[]> {
  const root = await findRoot(opts.cwd, opts.home);
  const lock = await readLock(root);
  const entries = Object.entries(lock.p);
  const out: OutdatedEntry[] = [];
  const queue = [...entries];
  const worker = async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      const [n, e] = item;
      const { client } = await clientFor(opts, n);
      const res = await client.resolve(n, 'latest');
      const kind = diffKind(e.v, res.root.v);
      if (kind && compareVersions(res.root.v, e.v) > 0) {
        const drift = driftCount(await driftOf(root, e, await readFilesIndex(root, n)));
        out.push({ n, v: e.v, latest: res.root.v, kind, drift });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(8, entries.length) }, worker));
  return out.sort((a, b) => a.n.localeCompare(b.n));
}

// ───────────── audit ─────────────

export type AuditFinding = {
  n: string;
  v: string;
  kind: 'advisory' | 'yanked' | 'quarantined' | 'signature' | 'tamper';
  severity: 'low' | 'medium' | 'high' | 'critical';
  id: string;
  detail: string;
  fix: string;
};
export type AuditReport = {
  ok: boolean;
  packages: number;
  signaturesValid: boolean;
  findings: AuditFinding[];
  drift: Record<string, number>;
};

/**
 * Verifica el proyecto (security §3.4): hashes en disco vs `.genpm/files` (drift esperado vs manipulación),
 * firma `sg` de cada entrada contra el registry (INV-8), advisories, versiones retiradas y cuarentenas.
 */
export async function audit(opts: CommonOptions): Promise<AuditReport> {
  const root = await findRoot(opts.cwd, opts.home);
  const lock = await readLock(root);
  const findings: AuditFinding[] = [];
  const drift: Record<string, number> = {};
  for (const [n, e] of Object.entries(lock.p)) {
    const index = await readFilesIndex(root, n);
    if (!index || integrityOf(index.f) !== e.h || index.c !== e.c) {
      findings.push({
        n,
        v: e.v,
        kind: 'tamper',
        severity: 'high',
        id: 'GENPM-TAMPER',
        detail: '.genpm/files does not match genpm.lock',
        fix: 'Restore genpm.lock and .genpm/ from Git',
      });
    }
    drift[n] = driftCount(await driftOf(root, e, index));
    if (!e.sg) {
      if (!e.t.startsWith('file:'))
        findings.push({
          n,
          v: e.v,
          kind: 'signature',
          severity: 'high',
          id: 'GENPM-UNSIGNED',
          detail: 'missing registry signature',
          fix: `Reinstall ${n} from the registry`,
        });
      continue;
    }
    try {
      const { client, registry } = await clientFor(opts, n);
      const remote = await client.version(n, e.v);
      const valid =
        remote.sg === e.sg &&
        remote.c === e.c &&
        (await verifyManifest(remote, e.sg, keysFor(registry), await revokedKeys({ registry, client }))).ok;
      if (!valid)
        findings.push({
          n,
          v: e.v,
          kind: 'signature',
          severity: 'critical',
          id: 'GENPM-SIGNATURE',
          detail: 'signature does not match the registry',
          fix: `Do not trust ${e.d}; reinstall ${n}`,
        });
      if (remote.yanked)
        findings.push({
          n,
          v: e.v,
          kind: 'yanked',
          severity: 'medium',
          id: 'GENPM-YANKED',
          detail: remote.yankReason ?? 'yanked',
          fix: `Install another version of ${n}`,
        });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'E_QUARANTINED')
        findings.push({
          n,
          v: e.v,
          kind: 'quarantined',
          severity: 'high',
          id: 'GENPM-QUARANTINE',
          detail: 'under security review',
          fix: `Avoid ${n}@${e.v} until the review ends`,
        });
      else if (code !== 'E_NETWORK') throw err;
    }
  }
  if (Object.keys(lock.p).length) {
    try {
      const { client } = await clientFor(opts, Object.keys(lock.p)[0]!);
      const adv = await client.advisories(Object.entries(lock.p).map(([n, e]) => ({ n, v: e.v })));
      for (const a of adv.advisories) {
        findings.push({
          n: a.n,
          v: a.v,
          kind: a.kind,
          severity: a.severity as AuditFinding['severity'],
          id: a.id,
          detail: a.title,
          fix: a.fix ?? '',
        });
      }
    } catch {
      // Sin advisories disponibles (offline o registry antiguo): el resto del informe sigue siendo válido.
    }
  }
  const signaturesValid = !findings.some((f) => f.kind === 'signature');
  const ok = !findings.some((f) => f.severity === 'high' || f.severity === 'critical');
  return { ok, packages: Object.keys(lock.p).length, signaturesValid, findings, drift };
}

// ───────────── compose (V03-05) ─────────────

export type ResolvedRecipe = { name: string; summary: string | null; specs: string[]; source: 'file' | 'registry' };

/**
 * Receta compose: archivo local (`./saas.json`, `file:…`, cualquier ruta acabada en `.json`) o slug del registry
 * (`saas-starter`). Se valida siempre con `validateRecipe`: solo specs del registry, sin duplicados.
 */
export async function loadRecipe(opts: CommonOptions & { recipe: string; locale?: string }): Promise<ResolvedRecipe> {
  const ref = opts.recipe.trim();
  const isFile = ref.startsWith('file:') || ref.startsWith('.') || ref.startsWith('/') || ref.endsWith('.json');
  if (isFile) {
    const path = ref.replace(/^file:/, '');
    const text = await readTextOrNull(isAbsolute(path) ? path : join(opts.cwd, path));
    if (text === null) throw fail('E_NOT_FOUND', { name: path });
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw fail('E_MANIFEST_INVALID', {}, { issues: [{ path, message: 'invalid JSON' }] });
    }
    const v = validateRecipe(raw);
    if (!v.ok) throw fail('E_MANIFEST_INVALID', {}, { issues: v.issues });
    return {
      name: v.data.name,
      summary: v.data.s === undefined ? null : (pickSummary(v.data.s, opts.locale ?? 'en') ?? null),
      specs: v.data.p,
      source: 'file',
    };
  }
  if (!RECIPE_SLUG_RE.test(ref)) throw fail('E_USAGE', { detail: 'genpm compose <recipe-name | ./recipe.json>' });
  const { client } = await clientFor(opts, null);
  const r = await client.recipe(ref);
  // El registry ya validó al guardar, pero el cliente no confía: se revalida antes de planificar.
  const v = validateRecipe({ name: r.name, p: r.p });
  if (!v.ok) throw fail('E_MANIFEST_INVALID', {}, { issues: v.issues });
  return { name: r.name, summary: r.summary, specs: v.data.p, source: 'registry' };
}

export async function listRecipes(opts: CommonOptions) {
  const { client } = await clientFor(opts, null);
  return client.recipes();
}
