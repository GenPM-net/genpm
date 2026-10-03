// core/plan (cli-mcp-spec §0): calcula el InstallPlan sin escribir nada en el proyecto (solo lee; puede llenar
// la caché global). Verifica la firma de cada manifiesto (INV-8), descarga por SHA (INV-1) y ejecuta el escáner
// local con las mismas reglas deterministas que el registry (doble verificación, security §3.1).

import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import {
  checkDest,
  createFileFilter,
  type ErrorCode,
  estimateTokens,
  type Finding,
  isAutorunFile,
  LIMITS,
  type McpServerEntry,
  normalizeMcp,
  parseSpec,
  type ResolvedManifest,
  type ScanFile,
  type Spec,
  satisfies,
  scanTree,
  validateSource,
  verifyManifest,
} from '@genpm/manifest';
import { loadRc, registryFor } from './config.js';
import {
  type Client,
  detectClients,
  detectPackageManager,
  findRoot,
  isEmptyDir,
  type PackageManager,
  readPackageDeps,
} from './detect.js';
import { fail } from './errors.js';
import { runGit } from './fetch/git.js';
import { type FetchedSource, type FetchOptions, fetchSource, sourcePath } from './fetch/index.js';
import { exists, readTextOrNull } from './fs/io.js';
import { safeDestPath } from './fs/safe-path.js';
import { contextOps, type InstalledRef } from './inject/context.js';
import { ENV_EXAMPLE } from './inject/env.js';
import { commandLine, MCP_FILES, mcpTargets } from './inject/mcp.js';
import { installCommand, missingDeps } from './inject/npm.js';
import { keysFor } from './keys.js';
import { LOCK_FILE, readLock } from './lock.js';
import { type ClientKind, RegistryClient } from './registry-client.js';
import { revokedKeys } from './revocation.js';

export type PlanInput = {
  specs: string[];
  cwd: string;
  dest?: string;
  clients?: string[];
  force?: boolean;
  allowAutorun?: boolean;
  registry?: string;
  token?: string | null;
  client?: ClientKind;
  telemetry?: boolean;
  /** Límite de tamaño por paquete en bytes (`--max-size`). */
  maxSize?: number;
  fetch?: FetchOptions;
  fetchImpl?: typeof fetch;
  home?: string;
  log?: (line: string) => void;
};

export type PlanPackage = {
  n: string;
  v: string;
  c: string;
  d: string;
  role: 'root' | 'dep';
  action: 'install' | 'skip' | 'conflict';
  reason?: string;
  files: number;
  bytes: number;
};

export type PlanConflict = { code: ErrorCode; n?: string; path?: string; detail: string; fix: string };

export type InstallPlan = {
  id: string;
  root: string;
  packages: PlanPackage[];
  context: Array<{ file: string; op: 'create' | 'update' }>;
  mcp: Array<{ n: string; command: string; env: string[]; targets: string[]; from: string }>;
  npm: { manager: PackageManager | null; add: Record<string, string>; command: string | null };
  env: string[];
  rulesPreview: Array<{ n: string; excerpt: string; tokens: number; scan: 'passed' | 'flagged' }>;
  conflicts: PlanConflict[];
  warnings: Array<{ code: string; detail: string }>;
  /** Paquetes ya instalados en el mismo commit cuya firma del registry cambió (rotación de clave): `apply()` solo
   * actualiza `sg` en genpm.lock, sin tocar archivos. La firma nueva ya está verificada (y no revocada). */
  resign: string[];
};

/** Datos internos que `apply()` necesita y que no viajan al LLM (no serializables). */
export type PlanInternal = {
  input: PlanInput;
  clients: Client[];
  packageManager: PackageManager | null;
  registry: string;
  items: Array<{
    manifest: ResolvedManifest;
    sg: string | null;
    dest: string;
    role: 'root' | 'dep';
    action: PlanPackage['action'];
    source: FetchedSource | null;
    /** Archivos a copiar, relativos a `i`. */
    files: Array<{ path: string; size: number; sha1: string | null }>;
    rules: string | null;
    excluded: string[];
  }>;
  fingerprint: string;
};

const INTERNAL = new WeakMap<InstallPlan, PlanInternal>();

export function planInternal(plan: InstallPlan): PlanInternal | undefined {
  return INTERNAL.get(plan);
}

const EXCERPT_CHARS = 1500;

function hash(v: unknown): string {
  return createHash('sha256').update(JSON.stringify(v)).digest('hex');
}

/** Huella del disco: si cambia entre plan() y apply() ⇒ E_PLAN_STALE. */
export async function fingerprintOf(root: string, dests: string[]): Promise<string> {
  const lock = (await readTextOrNull(join(root, LOCK_FILE))) ?? '';
  const states: string[] = [];
  for (const d of dests) {
    const abs = join(root, ...d.split('/'));
    states.push(`${d}:${(await exists(abs)) ? ((await isEmptyDir(abs)) ? 'empty' : 'full') : 'none'}`);
  }
  return hash({ lock, states });
}

async function resolveDirect(
  spec: Extract<Spec, { kind: 'github' }>,
  input: PlanInput,
): Promise<{ manifest: ResolvedManifest; source: FetchedSource }> {
  const r = `https://github.com/${spec.owner}/${spec.repo}`;
  let c = spec.ref;
  if (!/^[0-9a-f]{40}$/.test(c)) {
    const { stdout } = await runGit(
      ['ls-remote', '--tags', r, `refs/tags/${spec.ref}`, `refs/tags/${spec.ref}^{}`],
      input.fetch,
    );
    const lines = stdout.toString().trim().split('\n').filter(Boolean);
    const peeled = lines.find((l) => l.endsWith('^{}')) ?? lines[0];
    if (!peeled) throw fail('E_REF_NOT_FOUND', { ref: spec.ref, repo: r });
    c = peeled.split('\t')[0]!;
  }
  const source = await fetchSource({ r, c }, input.fetch);
  const raw = await readTextOrNull(join(source.dir, 'genpm.json'));
  if (raw === null) throw fail('E_MANIFEST_INVALID', {}, { issues: [{ path: 'genpm.json', message: 'missing' }] });
  const v = validateSource(JSON.parse(raw));
  if (!v.ok)
    throw fail(v.code, { path: 'genpm.json', reason: v.issues[0]?.message ?? '', ref: spec.ref }, { issues: v.issues });
  const manifest = {
    ...v.data,
    $: 1,
    r,
    t: spec.ref,
    c,
    i: v.data.i ?? '.',
    x: v.data.x ?? 'AGENTS.md',
    l: v.data.l ?? 'NOASSERTION',
  } as ResolvedManifest;
  return {
    manifest,
    source: v.data.i && v.data.i !== '.' ? await fetchSource({ r, c, i: v.data.i }, input.fetch) : source,
  };
}

async function readRules(source: FetchedSource, m: ResolvedManifest): Promise<string | null> {
  try {
    return await readFile(sourcePath(source, m.i, m.x), 'utf8');
  } catch {
    return null;
  }
}

export async function plan(input: PlanInput): Promise<InstallPlan> {
  if (input.specs.length === 0) throw fail('E_USAGE', { detail: 'no package given' });
  if (input.dest && input.specs.length > 1)
    throw fail('E_USAGE', { detail: '--dest only works with a single package' });
  const root = await findRoot(input.cwd, input.home);
  const rc = await loadRc(root, input.home);
  const clients = await detectClients(root, input.clients ?? rc.clients);
  const packageManager = await detectPackageManager(root);
  const lock = await readLock(root);
  const installed = Object.entries(lock.p).map(([n, e]) => `${n}@${e.v}`);
  const conflicts: PlanConflict[] = [];
  const resign: string[] = [];
  const warnings: InstallPlan['warnings'] = [];
  const items: PlanInternal['items'] = [];
  const seen = new Set<string>();
  let registryUsed = registryFor(null, rc, input.registry);

  for (const raw of input.specs) {
    const parsed = parseSpec(raw);
    if (!parsed.ok) throw fail('E_USAGE', { detail: `${raw}: ${parsed.problem}` });
    const spec = parsed.spec;
    if (spec.kind === 'file') throw fail('E_USAGE', { detail: 'file: specs are not supported yet' });
    if (spec.kind === 'github') {
      const { manifest, source } = await resolveDirect(spec, input);
      if (Object.keys(manifest.g ?? {}).length) {
        warnings.push({
          code: 'W_DIRECT_DEPS',
          detail: `${manifest.n} needs ${Object.keys(manifest.g ?? {}).join(', ')}: install them with genpm add`,
        });
      }
      items.push({
        manifest,
        sg: null,
        dest: input.dest ?? manifest.d,
        role: 'root',
        action: 'install',
        source,
        files: [],
        rules: null,
        excluded: [],
      });
      seen.add(manifest.n);
      continue;
    }
    const registry = registryFor(spec.name, rc, input.registry);
    registryUsed = registry;
    const client = new RegistryClient({
      registry,
      token: input.token ?? null,
      client: input.client ?? 'cli',
      telemetry: input.telemetry,
      fetchImpl: input.fetchImpl,
      log: input.log,
    });
    const res = await client.resolve(spec.name, spec.range, { deps: true, installed });
    for (const w of res.w) warnings.push({ code: w.code, detail: `${w.n}: ${w.msg}` });
    const keys = keysFor(registry);
    const revoked = await revokedKeys({ registry, client, cacheDir: input.fetch?.cacheDir });
    for (const [m, role] of [[res.root, 'root'], ...res.deps.map((d) => [d, 'dep'] as const)] as Array<
      [ResolvedManifest & { sg?: string }, 'root' | 'dep']
    >) {
      if (seen.has(m.n)) continue;
      seen.add(m.n);
      // INV-8: solo se instala un manifiesto con firma válida del registry.
      if (!m.sg) throw fail('E_SIGNATURE', { name: `${m.n}@${m.v}` });
      const verdict = await verifyManifest(m, m.sg, keys, revoked);
      if (!verdict.ok) throw fail('E_SIGNATURE', { name: `${m.n}@${m.v}` }, { reason: verdict.reason });
      const scan = res.scan[m.n];
      if (scan === 'flagged' || scan === 'failed') throw fail('E_QUARANTINED', { name: m.n });
      const { sg, ...manifest } = m;
      items.push({
        manifest: manifest as ResolvedManifest,
        sg,
        dest: role === 'root' && input.dest ? input.dest : m.d,
        role,
        action: 'install',
        source: null,
        files: [],
        rules: null,
        excluded: [],
      });
    }
  }

  // Estado de cada paquete frente al lock y al disco.
  const declared = await readPackageDeps(root);
  const takenDests = new Map(Object.entries(lock.p).map(([n, e]) => [e.d, n]));
  for (const it of items) {
    const m = it.manifest;
    const prev = lock.p[m.n];
    const destProblem = checkDest(it.dest);
    if (destProblem) throw fail('E_PATH_UNSAFE', { path: it.dest, reason: destProblem });
    await safeDestPath(root, it.dest);
    if (prev) {
      if (prev.c === m.c) {
        it.action = 'skip';
        if (it.sg && prev.sg !== it.sg) resign.push(m.n);
        continue;
      }
      if (
        it.role === 'dep' &&
        Object.values(items.map((x) => x.manifest.g ?? {})).every((g) => !g[m.n] || satisfies(prev.v, g[m.n]!))
      ) {
        it.action = 'skip';
        continue;
      }
      it.action = 'conflict';
      conflicts.push({
        code: 'E_ALREADY_INSTALLED',
        n: m.n,
        detail: `${m.n} ${prev.v} is installed; ${m.v} was requested`,
        fix: `Run genpm remove ${m.n} first (genpm update arrives in v0.2).`,
      });
      continue;
    }
    const owner = takenDests.get(it.dest);
    const abs = join(root, ...it.dest.split('/'));
    if (owner && owner !== m.n) {
      it.action = 'conflict';
      conflicts.push({
        code: 'E_DEST_CONFLICT',
        n: m.n,
        path: it.dest,
        detail: `${it.dest} belongs to ${owner}`,
        fix: 'Use --dest <dir> to install it elsewhere.',
      });
      continue;
    }
    if (!(await isEmptyDir(abs)) && !input.force) {
      it.action = 'conflict';
      const isFile = (await stat(abs)).isFile();
      conflicts.push({
        code: 'E_DEST_CONFLICT',
        n: m.n,
        path: it.dest,
        detail: `${it.dest} ${isFile ? 'is a file' : 'exists and is not empty'}`,
        fix: 'Use --dest <dir> or --force (backs up first).',
      });
    }
  }

  // Descarga por SHA + filtrado + escaneo local (doble verificación).
  const rulesPreview: InstallPlan['rulesPreview'] = [];
  const maxBytes = input.maxSize ?? LIMITS.packageBytes;
  for (const it of items) {
    if (it.action === 'skip') continue;
    const m = it.manifest;
    it.source ??= await fetchSource(
      { r: m.r, c: m.c, i: m.i },
      { ...input.fetch, fetchImpl: input.fetchImpl ?? input.fetch?.fetchImpl, log: input.log },
    );
    const ignoreText = await readTextOrNull(sourcePath(it.source, m.i, '.genpmignore'));
    const included = createFileFilter(ignoreText);
    const scanFiles: ScanFile[] = [];
    for (const e of it.source.entries) {
      if (e.type === 'submodule' || !included(e.path)) continue;
      const abs = sourcePath(it.source, m.i, e.path);
      const content = e.type === 'file' && e.size <= LIMITS.fileBytes ? await readFile(abs) : undefined;
      scanFiles.push({ path: e.path, size: e.size, content, isSymlink: e.type === 'symlink', mode: e.mode });
    }
    const report = scanTree(scanFiles, { contextPath: m.x, maxBytes });
    const autorun = new Set(
      scanFiles.filter((f) => isAutorunFile(f.path, f.content ? f.content.toString() : null)).map((f) => f.path),
    );
    const blocking = report.findings.filter(
      (f: Finding) => f.severity === 'fail' && !(input.allowAutorun && f.rule === 'autorun'),
    );
    if (blocking.length) {
      const first = blocking[0]!;
      if (first.rule === 'autorun')
        throw fail('E_AUTORUN_FILE', { name: m.n, files: [...autorun].join(', ') }, { findings: blocking });
      if (first.rule.startsWith('path.'))
        throw fail('E_PATH_UNSAFE', { path: first.path ?? m.n, reason: first.detail }, { findings: blocking });
      if (first.rule.startsWith('size.'))
        throw fail('E_TOO_LARGE', { name: m.n, detail: first.detail }, { findings: blocking });
      throw fail(
        'E_SCAN_FAILED',
        { name: m.n, detail: `${first.rule}${first.path ? ` (${first.path})` : ''}` },
        { findings: blocking },
      );
    }
    for (const f of report.findings.filter((x) => x.severity === 'warn' || x.severity === 'flag')) {
      warnings.push({
        code: f.severity === 'flag' ? 'W_SCAN_FLAGGED' : `W_${f.rule.toUpperCase().replace(/\./g, '_')}`,
        detail: `${m.n}: ${f.rule}${f.path ? ` ${f.path}` : ''} ${f.detail}`,
      });
    }
    if (input.allowAutorun && autorun.size)
      warnings.push({ code: 'W_AUTORUN_ALLOWED', detail: `${m.n}: ${[...autorun].join(', ')}` });
    it.files = scanFiles
      .filter((f) => !f.isSymlink && (input.allowAutorun || !autorun.has(f.path)))
      .map((f) => ({
        path: f.path,
        size: f.size,
        sha1: it.source!.entries.find((e) => e.path === f.path)?.sha1 ?? null,
      }));
    it.excluded = [...autorun];
    it.rules = await readRules(it.source, m);
    if (it.rules === null) warnings.push({ code: 'W_CONTEXT_MISSING', detail: `${m.n}: ${m.x}` });
    else {
      rulesPreview.push({
        n: m.n,
        excerpt: it.rules.slice(0, EXCERPT_CHARS),
        tokens: estimateTokens(it.rules),
        scan: report.status === 'flagged' ? 'flagged' : 'passed',
      });
    }
  }

  // Contexto, MCP, npm y env para lo que se va a instalar.
  const toInstall = items.filter((i) => i.action === 'install');
  const finalInstalled: InstalledRef[] = [
    ...Object.entries(lock.p).map(([n, e]) => ({ n, v: e.v, d: e.d })),
    ...toInstall.map((i) => ({ n: i.manifest.n, v: i.manifest.v, d: i.dest })),
  ];
  const ops = contextOps(
    clients,
    toInstall.map((i) => ({ ref: { n: i.manifest.n, v: i.manifest.v, d: i.dest }, rules: i.rules ?? '' })),
    finalInstalled,
  );
  const context: InstallPlan['context'] = [];
  for (const op of ops) {
    context.push({ file: op.path, op: (await exists(join(root, ...op.path.split('/')))) ? 'update' : 'create' });
  }
  const envVars = [...new Set(toInstall.flatMap((i) => i.manifest.e ?? []))];
  if (envVars.length)
    context.push({ file: ENV_EXAMPLE, op: (await exists(join(root, ENV_EXAMPLE))) ? 'update' : 'create' });
  const targets = mcpTargets(clients);
  const mcp: InstallPlan['mcp'] = [];
  for (const it of toInstall) {
    for (const entry of (it.manifest.m ?? []) as McpServerEntry[]) {
      const s = normalizeMcp(entry);
      if (s.c && !['npx', 'uvx', 'bunx', 'docker', 'node', 'python', 'deno'].includes(s.c)) {
        warnings.push({ code: 'W_MCP_COMMAND', detail: `${it.manifest.n}: MCP "${s.n}" runs "${s.c}"` });
      }
      mcp.push({
        n: s.n,
        command: commandLine(s),
        env: s.e ?? [],
        targets: targets.map((t) => MCP_FILES[t]),
        from: it.manifest.n,
      });
    }
  }
  const wanted: Record<string, string> = {};
  for (const it of toInstall) Object.assign(wanted, it.manifest.p ?? {});
  const add = missingDeps(wanted, declared);

  const packages: PlanPackage[] = items.map((it) => {
    const prev = lock.p[it.manifest.n];
    return {
      n: it.manifest.n,
      v: it.manifest.v,
      c: it.manifest.c,
      d: it.dest,
      role: it.role,
      action: it.action,
      ...(it.action === 'skip' && prev ? { reason: `already installed ${prev.v}` } : {}),
      ...(it.action === 'conflict'
        ? { reason: conflicts.find((c) => c.n === it.manifest.n)?.detail ?? 'conflict' }
        : {}),
      files: it.files.length,
      bytes: it.files.reduce((n, f) => n + f.size, 0),
    };
  });

  const fingerprint = await fingerprintOf(
    root,
    items.map((i) => i.dest),
  );
  const body = {
    root,
    packages,
    context,
    mcp,
    npm: { manager: packageManager, add, command: installCommand(packageManager, add) },
    env: envVars,
    rulesPreview,
    conflicts,
    warnings,
    resign,
  };
  const result: InstallPlan = { id: hash({ ...body, fingerprint, clients }).slice(0, 16), ...body };
  INTERNAL.set(result, { input, clients, packageManager, registry: registryUsed, items, fingerprint });
  return result;
}
