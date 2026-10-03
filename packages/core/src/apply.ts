// core/apply (architecture §6.1 paso 4, §7.2): ejecuta el plan con un journal de operaciones y rollback completo.
// INV-3: toda ruta pasa por safePath; staging en `.genpm/tmp` + rename atómico. INV-4: archivos 0o644.
// INV-5: MCP y npm solo con consentimiento explícito. INV-6: nunca se lee `.env`.

import { execFile } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { chmod, mkdir, readdir, readFile, rename, rm, rmdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { LockEntry } from '@genpm/manifest';
import { withLock } from './busy.js';
import { fail } from './errors.js';
import { gitBlobSha1, sourcePath } from './fetch/index.js';
import { exists, readTextOrNull, writeFileAtomic } from './fs/io.js';
import { safeDestPath, safePath } from './fs/safe-path.js';
import { applyBlock, contextOps, type InstalledRef } from './inject/context.js';
import { ENV_EXAMPLE, updateEnvExample } from './inject/env.js';
import { MCP_FILES, mcpTargets, mergeMcpConfig } from './inject/mcp.js';
import { installArgs } from './inject/npm.js';
import { integrityOf, LOCK_FILE, readLock, STATE_DIR, sri, writeFilesIndex, writeLock } from './lock.js';
import { fingerprintOf, type InstallPlan, planInternal } from './plan.js';

export type ApplyOptions = {
  allowMcp: boolean;
  installNpmDeps: boolean;
  by: 'cli' | 'mcp';
  /** Solo tests (D2-G-03): se invoca tras cada paso; si lanza, se fuerza el rollback. */
  onStep?: (step: string) => void;
  log?: (line: string) => void;
};

export type ApplyResult = {
  ok: true;
  installed: Array<{ n: string; v: string; c: string; d: string }>;
  written: string[];
  mcpWritten: string[];
  npmRan: boolean;
  durationMs: number;
  next: string[];
};

type JournalEntry =
  | { op: 'created'; abs: string }
  | { op: 'replaced'; abs: string; previous: Buffer }
  | { op: 'moved'; from: string; to: string }
  | { op: 'mkdir'; abs: string }
  | { op: 'rmdir'; abs: string };

class Journal {
  private entries: JournalEntry[] = [];

  push(e: JournalEntry) {
    this.entries.push(e);
  }

  async rollback(): Promise<void> {
    for (const e of this.entries.reverse()) {
      try {
        if (e.op === 'created') await rm(e.abs, { recursive: true, force: true });
        else if (e.op === 'replaced') await writeFile(e.abs, e.previous);
        else if (e.op === 'moved') {
          await rm(e.from, { recursive: true, force: true });
          await rename(e.to, e.from);
        } else if (e.op === 'mkdir') await rmdir(e.abs).catch(() => undefined);
        else if (e.op === 'rmdir') await mkdir(e.abs, { recursive: true });
      } catch {
        // Rollback best-effort: se continúa con el resto de entradas.
      }
    }
    this.entries = [];
  }
}

/** Crea los directorios que falten registrándolos en el journal (para poder borrarlos al revertir). */
async function ensureDir(abs: string, journal: Journal): Promise<void> {
  const missing: string[] = [];
  let cur = abs;
  while (!(await exists(cur))) {
    missing.unshift(cur);
    const parent = dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  for (const d of missing) {
    await mkdir(d);
    journal.push({ op: 'mkdir', abs: d });
  }
}

/** Escribe un archivo de texto registrando el estado anterior. Devuelve `true` si cambió. */
async function writeTracked(root: string, rel: string, content: string, journal: Journal): Promise<boolean> {
  const abs = await safePath(root, rel);
  const prev = await readFile(abs).catch(() => null);
  if (prev !== null && prev.toString('utf8') === content) return false;
  await ensureDir(dirname(abs), journal);
  journal.push(prev === null ? { op: 'created', abs } : { op: 'replaced', abs, previous: prev });
  await writeFileAtomic(abs, content);
  return true;
}

async function runPackageManager(
  root: string,
  pm: string,
  args: string[],
  log?: (l: string) => void,
): Promise<boolean> {
  // En Windows los gestores son `.cmd` y Node exige shell para ejecutarlos: no lo hacemos (INV-2), se propone el comando.
  if (process.platform === 'win32') return false;
  log?.(`${pm} ${args.join(' ')}`);
  return new Promise((resolve) => {
    execFile(pm, args, { cwd: root, timeout: 10 * 60_000, windowsHide: true }, (err) => resolve(!err));
  });
}

async function ensureStateDir(root: string, journal: Journal): Promise<void> {
  const gi = `${STATE_DIR}/.gitignore`;
  if (!(await exists(join(root, STATE_DIR, '.gitignore')))) {
    await writeTracked(
      root,
      gi,
      '# GenPM: staging, backups y candado (files/ sí se commitea)\ntmp/\nbackup/\n.lock\n',
      journal,
    );
  }
}

export async function apply(plan: InstallPlan, opts: ApplyOptions): Promise<ApplyResult> {
  const internal = planInternal(plan);
  if (!internal) throw fail('E_PLAN_STALE');
  if (plan.conflicts.length && !internal.input.force) {
    const c = plan.conflicts[0]!;
    throw fail(
      c.code,
      { name: c.n ?? '', path: c.path ?? '', version: '', detail: c.detail },
      { conflicts: plan.conflicts },
    );
  }
  const started = Date.now();
  const root = plan.root;
  const step = (s: string) => opts.onStep?.(s);

  return withLock(root, async () => {
    if (
      (await fingerprintOf(
        root,
        internal.items.map((i) => i.dest),
      )) !== internal.fingerprint
    )
      throw fail('E_PLAN_STALE');
    const journal = new Journal();
    const written = new Set<string>();
    const mcpWritten: string[] = [];
    const installed: ApplyResult['installed'] = [];
    const stagingRoot = await safePath(root, `${STATE_DIR}/tmp/${randomBytes(6).toString('hex')}`);
    try {
      await ensureStateDir(root, journal);
      const lock = await readLock(root);
      const toInstall = internal.items.filter(
        (i) => i.action === 'install' || (i.action === 'conflict' && internal.input.force),
      );

      for (const it of toInstall) {
        const m = it.manifest;
        const src = it.source!;
        const destAbs = await safeDestPath(root, it.dest);
        const staging = join(stagingRoot, m.n.replace(/[@/]/g, '_'));
        await mkdir(staging, { recursive: true });
        const index: Record<string, string> = {};
        // Copia con modo 0o644 (INV-4) y re-verificación del hash git contra la caché (INV-1).
        for (const f of it.files) {
          const data = await readFile(sourcePath(src, m.i, f.path));
          if (f.sha1 && f.sha1.length === 40 && gitBlobSha1(data) !== f.sha1)
            throw fail('E_INTEGRITY', { name: m.n, detail: `${f.path} changed in cache` });
          const out = join(staging, ...f.path.split('/'));
          await mkdir(dirname(out), { recursive: true });
          await writeFile(out, data, { mode: 0o644 });
          await chmod(out, 0o644);
          index[f.path] = sri(data);
        }
        // Reglas del paquete siempre en `<d>/AGENTS.md` (si `x` vive en otra ruta, se copia también aquí).
        if (it.rules !== null && m.x !== 'AGENTS.md') {
          await writeFile(join(staging, 'AGENTS.md'), it.rules, { mode: 0o644 });
          index['AGENTS.md'] = sri(it.rules);
        }
        step(`staged:${m.n}`);
        // Destino: vacío o inexistente; con --force el contenido anterior va a .genpm/backup/<ts>/.
        if (await exists(destAbs)) {
          if ((await readdir(destAbs)).length > 0 || !(await stat(destAbs)).isDirectory()) {
            if (!internal.input.force) throw fail('E_DEST_CONFLICT', { path: it.dest });
            const backup = await safePath(
              root,
              `${STATE_DIR}/backup/${new Date().toISOString().replace(/[:.]/g, '-')}/${it.dest}`,
            );
            await mkdir(dirname(backup), { recursive: true });
            await rename(destAbs, backup);
            journal.push({ op: 'moved', from: destAbs, to: backup });
          } else {
            await rmdir(destAbs);
            journal.push({ op: 'rmdir', abs: destAbs });
          }
        }
        await ensureDir(dirname(destAbs), journal);
        await rename(staging, destAbs);
        journal.push({ op: 'created', abs: destAbs });
        written.add(it.dest);
        step(`copied:${m.n}`);

        const entry: LockEntry = {
          v: m.v,
          r: m.r,
          t: m.t,
          c: m.c,
          d: it.dest,
          x: m.x,
          h: integrityOf(index),
          ...(it.sg ? { sg: it.sg } : {}),
          m: 0,
          by: opts.by,
          ...(m.g && Object.keys(m.g).length ? { g: m.g } : {}),
        };
        lock.p[m.n] = entry;
        const fiRel = `${STATE_DIR}/files/${m.n.replace(/^@/, '').replace('/', '__')}.json`;
        const fiAbs = await safePath(root, fiRel);
        const prevFi = await readFile(fiAbs).catch(() => null);
        await ensureDir(dirname(fiAbs), journal);
        journal.push(
          prevFi === null ? { op: 'created', abs: fiAbs } : { op: 'replaced', abs: fiAbs, previous: prevFi },
        );
        await writeFilesIndex(root, m.n, { c: m.c, f: index });
        written.add(fiRel);
        installed.push({ n: m.n, v: m.v, c: m.c, d: it.dest });
      }

      // Contexto con alcance: archivos por IDE + índices raíz (bloques gestionados).
      const all: InstalledRef[] = Object.entries(lock.p).map(([n, e]) => ({ n, v: e.v, d: e.d }));
      const ops = contextOps(
        internal.clients,
        toInstall.map((i) => ({ ref: { n: i.manifest.n, v: i.manifest.v, d: i.dest }, rules: i.rules ?? '' })),
        all,
      );
      for (const op of ops) {
        if (op.kind === 'file') {
          if (await writeTracked(root, op.path, op.content, journal)) written.add(op.path);
        } else {
          const current = await readTextOrNull(await safePath(root, op.path));
          if (await writeTracked(root, op.path, applyBlock(current, op), journal)) written.add(op.path);
        }
      }
      step('context');

      // `.env.example`: bloque con los nombres de todas las variables de los paquetes instalados (nunca valores).
      const envByPkg = toInstall.map((i) => ({ n: i.manifest.n, e: i.manifest.e ?? [] })).filter((p) => p.e.length);
      if (envByPkg.length) {
        const current = await readTextOrNull(await safePath(root, ENV_EXAMPLE));
        const existing = current?.match(/# genpm:env:start\n([\s\S]*?)\n# genpm:env:end/)?.[1] ?? '';
        const prevByPkg: Array<{ n: string; e: string[] }> = [];
        let curPkg: { n: string; e: string[] } | null = null;
        for (const line of existing.split('\n')) {
          if (line.startsWith('# @')) {
            curPkg = { n: line.slice(2), e: [] };
            prevByPkg.push(curPkg);
          } else if (curPkg && /^[A-Z][A-Z0-9_]*=/.test(line)) curPkg.e.push(line.split('=')[0]!);
        }
        const merged = [...prevByPkg.filter((p) => !envByPkg.some((x) => x.n === p.n)), ...envByPkg];
        if (await writeTracked(root, ENV_EXAMPLE, updateEnvExample(current, merged), journal)) written.add(ENV_EXAMPLE);
      }
      step('env');

      // MCP (INV-5): solo con consentimiento.
      if (opts.allowMcp) {
        for (const target of mcpTargets(internal.clients)) {
          const servers = toInstall.flatMap((i) => i.manifest.m ?? []);
          if (!servers.length) continue;
          const rel = MCP_FILES[target];
          const current = await readTextOrNull(await safePath(root, rel));
          const merged = mergeMcpConfig(current, target, servers);
          if (merged.changed && (await writeTracked(root, rel, merged.text, journal))) mcpWritten.push(rel);
        }
        for (const it of toInstall) if ((it.manifest.m ?? []).length) lock.p[it.manifest.n]!.m = 1;
      }
      step('mcp');

      for (const n of plan.resign ?? []) {
        const it = internal.items.find((i) => i.manifest.n === n);
        const entry = lock.p[n];
        if (entry && it?.sg && entry.c === it.manifest.c) entry.sg = it.sg;
      }

      const lockAbs = await safePath(root, LOCK_FILE);
      const prevLock = await readFile(lockAbs).catch(() => null);
      journal.push(
        prevLock === null ? { op: 'created', abs: lockAbs } : { op: 'replaced', abs: lockAbs, previous: prevLock },
      );
      await writeLock(root, lock);
      written.add(LOCK_FILE);
      step('lock');
    } catch (e) {
      await journal.rollback();
      await rm(stagingRoot, { recursive: true, force: true });
      throw e;
    }
    await rm(stagingRoot, { recursive: true, force: true });
    await rmdir(dirname(stagingRoot)).catch(() => undefined);

    // npm (INV-5): fuera del journal; un fallo aquí no deshace la inyección.
    let npmRan = false;
    if (opts.installNpmDeps && plan.npm.manager && Object.keys(plan.npm.add).length) {
      npmRan = await runPackageManager(root, plan.npm.manager, installArgs(plan.npm.manager, plan.npm.add), opts.log);
    }

    const next: string[] = [];
    if (plan.env.length) next.push(`Set ${plan.env.join(', ')} (see .env.example)`);
    for (const it of installed) next.push(`Follow "Integration" in ${it.d}/AGENTS.md`);
    if (plan.npm.command && !npmRan) next.push(`Run ${plan.npm.command}`);
    if (plan.mcp.length && !opts.allowMcp)
      next.push(`Enable MCP later: genpm mcp add ${[...new Set(plan.mcp.map((m) => m.from))].join(' ')}`);
    return {
      ok: true,
      installed,
      written: [...written].sort(),
      mcpWritten,
      npmRan,
      durationMs: Date.now() - started,
      next,
    };
  });
}

/** Hash sha256 hex (utilidad para tests y doctor). */
export function sha256Hex(data: Uint8Array | string): string {
  return createHash('sha256').update(data).digest('hex');
}
