// Operaciones de autor (cli-mcp-spec §A.6): validate, init y publish. `validate` ejecuta exactamente el mismo
// escáner determinista que el registry, para que publicar no dé sorpresas.

import { lstat, readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import {
  agentsTemplate,
  checkRef,
  createFileFilter,
  DEFAULTS,
  type ErrorCode,
  LIMITS,
  type ScanFile,
  type SourceManifest,
  type StaticQuality,
  scanTree,
  staticQuality,
  validateSource,
} from '@genpm/manifest';
import { fail } from './errors.js';
import { runGit } from './fetch/git.js';
import { exists, readTextOrNull, writeFileAtomic } from './fs/io.js';
import { safePath } from './fs/safe-path.js';
import { type ClientKind, RegistryClient } from './registry-client.js';

export type ValidationIssue = { code: ErrorCode | string; path?: string; message: string };
export type ValidationReport = {
  ok: boolean;
  manifest: SourceManifest | null;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  files: number;
  bytes: number;
  rulesTokens: number;
  fileList: string[];
  /** Comprobaciones de calidad que dependen solo del paquete (V02-04); el resto las añade el registry. */
  quality: StaticQuality | null;
};

async function walk(root: string, base: string, out: Array<{ path: string; abs: string }>): Promise<void> {
  for (const e of await readdir(base, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules') continue;
    const abs = join(base, e.name);
    if (e.isDirectory() && !e.isSymbolicLink()) await walk(root, abs, out);
    else out.push({ path: relative(root, abs).split('\\').join('/'), abs });
  }
}

/** `genpm validate [path]` (cli-mcp-spec §A.6). */
export async function validate(opts: { path?: string; cwd: string; manifest?: string }): Promise<ValidationReport> {
  const dir = resolve(opts.cwd, opts.path ?? '.');
  const manifestPath = join(dir, opts.manifest ?? 'genpm.json');
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const empty = (): ValidationReport => ({
    ok: false,
    manifest: null,
    errors,
    warnings,
    files: 0,
    bytes: 0,
    rulesTokens: 0,
    fileList: [],
    quality: null,
  });
  const raw = await readTextOrNull(manifestPath);
  if (raw === null) {
    errors.push({ code: 'E_MANIFEST_INVALID', path: 'genpm.json', message: 'genpm.json not found (run genpm init)' });
    return empty();
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    errors.push({ code: 'E_MANIFEST_INVALID', path: 'genpm.json', message: 'invalid JSON' });
    return empty();
  }
  const v = validateSource(json);
  if (!v.ok) {
    for (const i of v.issues) errors.push({ code: v.code, path: i.path, message: i.message });
    return empty();
  }
  const m = v.data;
  if (m.t && checkRef(m.t))
    errors.push({ code: 'E_REF_MUTABLE', path: 't', message: `"${m.t}" is not a tag or full SHA` });
  const i = m.i ?? DEFAULTS.include;
  const x = m.x ?? DEFAULTS.context;
  // `i` es relativo a la raíz del repo; en monorepos el manifiesto puede vivir en un subdirectorio.
  const repoRoot = await gitTopLevel(dir).catch(() => dir);
  const includeAbs = join(repoRoot, ...(i === '.' ? [] : i.split('/')));
  if (!(await exists(includeAbs))) {
    errors.push({ code: 'E_PATH_UNSAFE', path: 'i', message: `${i} does not exist` });
    return { ...empty(), manifest: m };
  }
  const all: Array<{ path: string; abs: string }> = [];
  await walk(includeAbs, includeAbs, all);
  const included = createFileFilter(await readTextOrNull(join(includeAbs, '.genpmignore')));
  const files: ScanFile[] = [];
  for (const f of all.filter((f) => included(f.path))) {
    const st = await lstat(f.abs);
    files.push({
      path: f.path,
      size: st.size,
      isSymlink: st.isSymbolicLink(),
      mode: st.mode,
      content: st.isFile() && st.size <= LIMITS.fileBytes ? await readFile(f.abs) : undefined,
    });
  }
  const contextFile = files.find((f) => f.path === x);
  if (!contextFile) {
    (m.x ? errors : warnings).push({ code: 'E_CONTEXT_MISSING', path: x, message: `${x} not found inside ${i}` });
  } else if (contextFile.size > LIMITS.contextBytes) {
    errors.push({ code: 'E_CONTEXT_TOO_LARGE', path: x, message: `${contextFile.size} bytes > 16 KB` });
  }
  const report = scanTree(files, { contextPath: x });
  for (const f of report.findings) {
    const issue = { code: f.rule, path: f.path, message: f.detail };
    if (f.severity === 'fail') errors.push(issue);
    else warnings.push(issue);
  }
  if (report.rulesTokens > LIMITS.rulesTokensRecommended) {
    warnings.push({
      code: 'rules.tokens',
      path: x,
      message: `~${report.rulesTokens} tokens (recommended ≤ ${LIMITS.rulesTokensRecommended})`,
    });
  }
  if (!m.s) warnings.push({ code: 'summary', path: 's', message: 'add a one-line summary (s) to appear in search' });
  if (!m.l && !(await exists(join(repoRoot, 'LICENSE'))))
    warnings.push({ code: 'license', path: 'l', message: 'no license declared or LICENSE file found' });
  return {
    ok: errors.length === 0,
    manifest: m,
    errors,
    warnings,
    files: report.files,
    bytes: report.bytes,
    rulesTokens: report.rulesTokens,
    fileList: files.map((f) => f.path).sort(),
    quality: staticQuality({
      license: m.l ?? ((await exists(join(repoRoot, 'LICENSE'))) ? 'LICENSE' : null),
      rules: contextFile?.content ? contextFile.content.toString() : null,
      paths: all.map((f) => f.path),
    }),
  };
}

async function gitTopLevel(dir: string): Promise<string> {
  const { stdout } = await runGit(['rev-parse', '--show-toplevel'], { cwd: dir });
  return stdout.toString().trim();
}

// ───────────── init ─────────────

export type InitAnswers = { n: string; v?: string; s?: string; d: string; k?: string[]; l?: string };

export { agentsTemplate };

export const GENPMIGNORE_TEMPLATE = `# Files that GenPM never injects (gitignore syntax, relative to "i")
tests/
*.test.ts
*.spec.ts
examples/
CHANGELOG.md
`;

export function publishWorkflow(): string {
  return `# Publishes to GenPM when a v* tag is pushed (genpm init).
name: genpm-publish
on:
  push:
    tags: ['v*']
permissions:
  contents: read
  # Trusted publishing (OIDC): authorize this repo at https://genpm.net/settings/publishing and no token is needed.
  id-token: write
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      # Native genpm binary, no Node.js needed: https://genpm.net/docs/install
      - run: curl -fsSL https://genpm.net/install.sh | sh
        env:
          GENPM_NO_MODIFY_PATH: '1'
      - run: ~/.genpm/bin/genpm publish --ref "$GITHUB_REF_NAME"
        env:
          # Only if you do not use trusted publishing; when empty, genpm uses OIDC.
          GENPM_TOKEN: \${{ secrets.GENPM_TOKEN }}
`;
}

export async function detectLicense(dir: string): Promise<string | undefined> {
  const text = (await readTextOrNull(join(dir, 'LICENSE'))) ?? (await readTextOrNull(join(dir, 'LICENSE.md')));
  if (!text) return undefined;
  if (/MIT License/i.test(text)) return 'MIT';
  if (/Apache License,? Version 2\.0/i.test(text)) return 'Apache-2.0';
  if (/BSD 3-Clause/i.test(text)) return 'BSD-3-Clause';
  if (/ISC License/i.test(text)) return 'ISC';
  if (/GNU GENERAL PUBLIC LICENSE\s+Version 3/i.test(text)) return 'GPL-3.0-only';
  return undefined;
}

export async function init(opts: {
  cwd: string;
  answers: InitAnswers;
  workflow?: boolean;
  force?: boolean;
}): Promise<{ written: string[]; manifest: SourceManifest }> {
  const a = opts.answers;
  const manifest: Record<string, unknown> = { $: 1, n: a.n, v: a.v ?? '0.1.0' };
  if (a.s) manifest['s'] = { en: a.s };
  manifest['d'] = a.d;
  manifest['x'] = 'AGENTS.md';
  const license = a.l ?? (await detectLicense(opts.cwd));
  if (license) manifest['l'] = license;
  if (a.k?.length) manifest['k'] = a.k;
  const v = validateSource(manifest);
  if (!v.ok)
    throw fail(v.code, { path: 'genpm.json', reason: v.issues[0]?.message ?? '', ref: '' }, { issues: v.issues });
  const written: string[] = [];
  const write = async (rel: string, content: string, overwrite: boolean) => {
    const abs = await safePath(opts.cwd, rel);
    if (!overwrite && (await exists(abs))) return;
    await writeFileAtomic(abs, content);
    written.push(rel);
  };
  if ((await exists(join(opts.cwd, 'genpm.json'))) && !opts.force)
    throw fail('E_DEST_CONFLICT', { path: 'genpm.json' });
  await write('genpm.json', `${JSON.stringify(v.data, null, 2)}\n`, true);
  await write('AGENTS.md', agentsTemplate(a.n), false);
  await write('.genpmignore', GENPMIGNORE_TEMPLATE, false);
  if (opts.workflow) await write('.github/workflows/genpm-publish.yml', publishWorkflow(), false);
  return { written, manifest: v.data };
}

// ───────────── publish ─────────────

export function normalizeGitRemote(url: string): string | null {
  const ssh = url.match(/^git@github\.com:([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?$/);
  if (ssh) return `https://github.com/${ssh[1]}/${ssh[2]}`;
  const https = url.match(
    /^(?:https|ssh):\/\/(?:[^@/]+@)?github\.com\/([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?\/?$/,
  );
  if (https) return `https://github.com/${https[1]}/${https[2]}`;
  return null;
}

export type PublishInput = {
  cwd: string;
  registry: string;
  token: string;
  manifest?: string;
  ref?: string;
  distTag?: string;
  dryRun?: boolean;
  client?: ClientKind;
  fetchImpl?: typeof fetch;
  log?: (l: string) => void;
};

/** validate → árbol limpio → tag en el remoto apuntando al mismo SHA → POST /v1/publish (cli-mcp-spec §A.6). */
export async function publish(input: PublishInput) {
  const report = await validate({ cwd: input.cwd, manifest: input.manifest });
  if (!report.ok || !report.manifest) {
    const first = report.errors[0];
    throw fail(
      'E_MANIFEST_INVALID',
      {},
      { issues: report.errors.map((e) => ({ path: e.path ?? '', message: `${e.code}: ${e.message}` })), first },
    );
  }
  const m = report.manifest;
  // El remoto es la configuración del propio autor (no contenido de terceros): se admite también un remoto local.
  const g = (args: string[]) =>
    runGit(args, { cwd: input.cwd, log: input.log, allowFileProtocol: true }).then((r) => r.stdout.toString().trim());
  if ((await g(['status', '--porcelain'])) !== '')
    throw fail('E_USAGE', { detail: 'the Git working tree is not clean; commit or stash first' });
  const repo = m.r ?? normalizeGitRemote(await g(['remote', 'get-url', 'origin']));
  if (!repo) throw fail('E_REPO_NOT_ALLOWED', { repo: 'origin', scope: m.n.split('/')[0]!.slice(1) });
  const ref = input.ref ?? m.t ?? `v${m.v}`;
  if (checkRef(ref)) throw fail('E_REF_MUTABLE', { ref });
  const isSha = /^[0-9a-f]{40}$/.test(ref);
  if (!isSha) {
    const local = await g(['rev-parse', `${ref}^{commit}`]).catch(() => '');
    if (!local) throw fail('E_REF_NOT_FOUND', { ref, repo });
    const remote = await g(['ls-remote', '--tags', 'origin', `refs/tags/${ref}`, `refs/tags/${ref}^{}`]);
    const lines = remote.split('\n').filter(Boolean);
    const remoteSha = (lines.find((l) => l.endsWith('^{}')) ?? lines[0])?.split('\t')[0];
    if (remoteSha !== local) throw fail('E_REF_NOT_PUSHED', { ref });
  }
  const client = new RegistryClient({
    registry: input.registry,
    token: input.token,
    client: input.client ?? 'cli',
    fetchImpl: input.fetchImpl,
    log: input.log,
  });
  const manifestPath = input.manifest
    ? relative(await gitTopLevel(input.cwd), resolve(input.cwd, input.manifest))
        .split('\\')
        .join('/')
    : 'genpm.json';
  return client.publish({
    name: m.n,
    version: m.v,
    repo,
    ref,
    manifestPath,
    distTag: input.distTag,
    dryRun: input.dryRun,
  });
}
