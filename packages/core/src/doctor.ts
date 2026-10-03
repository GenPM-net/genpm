// `genpm doctor` (cli-mcp-spec §A.5): cada check devuelve estado + `fix` accionable.

import { join } from 'node:path';
import { loadRc, registryFor } from './config.js';
import { getToken } from './credentials.js';
import { detectClients, detectPackageManager, findRoot } from './detect.js';
import { gitAtLeast, gitVersion } from './fetch/git.js';
import { exists } from './fs/io.js';
import { integrityOf, readFilesIndex, readLock } from './lock.js';
import { RegistryClient } from './registry-client.js';

export type Check = { id: string; status: 'ok' | 'warn' | 'fail'; detail: string; fix?: string };

export async function doctor(opts: {
  cwd: string;
  registry?: string;
  home?: string;
  fetchImpl?: typeof fetch;
  locale?: { locale: string; source: string };
}): Promise<Check[]> {
  const checks: Check[] = [];
  const [major, minor] = process.versions.node.split('.').map(Number) as [number, number];
  checks.push(
    major > 20 || (major === 20 && minor >= 11)
      ? { id: 'node', status: 'ok', detail: `Node.js ${process.versions.node}` }
      : {
          id: 'node',
          status: 'fail',
          detail: `Node.js ${process.versions.node}`,
          fix: 'Install Node.js 20.11 or later.',
        },
  );
  const gv = await gitVersion();
  checks.push(
    gitAtLeast(gv)
      ? { id: 'git', status: 'ok', detail: `git ${gv}` }
      : {
          id: 'git',
          status: 'warn',
          detail: gv ? `git ${gv} (< 2.25)` : 'git not found',
          fix: 'Install Git 2.25+ (without it GenPM falls back to GitHub tarballs).',
        },
  );
  if (opts.locale)
    checks.push({ id: 'language', status: 'ok', detail: `${opts.locale.locale} (from ${opts.locale.source})` });
  let root: string | null = null;
  try {
    root = await findRoot(opts.cwd, opts.home);
    checks.push({ id: 'project', status: 'ok', detail: root });
  } catch {
    checks.push({
      id: 'project',
      status: 'warn',
      detail: `no project found from ${opts.cwd}`,
      fix: 'Run inside a project (package.json or .git) or pass --cwd.',
    });
  }
  const rc = await loadRc(root, opts.home);
  if (root) {
    const clients = await detectClients(root, rc.clients);
    checks.push({ id: 'clients', status: 'ok', detail: clients.join(', ') });
    const pm = await detectPackageManager(root);
    checks.push({
      id: 'package-manager',
      status: pm ? 'ok' : 'warn',
      detail: pm ?? 'none detected',
      ...(pm ? {} : { fix: 'Add a package.json to let GenPM propose npm dependencies.' }),
    });
    try {
      const lock = await readLock(root);
      const problems: string[] = [];
      for (const [n, e] of Object.entries(lock.p)) {
        if (!(await exists(join(root, ...e.d.split('/'))))) problems.push(`${n}: ${e.d} missing`);
        const idx = await readFilesIndex(root, n);
        if (!idx) problems.push(`${n}: .genpm/files missing`);
        else if (integrityOf(idx.f) !== e.h) problems.push(`${n}: integrity mismatch`);
      }
      checks.push(
        problems.length
          ? {
              id: 'lock',
              status: 'fail',
              detail: problems.join('; '),
              fix: 'Run genpm audit; restore genpm.lock and .genpm/ from Git, or reinstall.',
            }
          : { id: 'lock', status: 'ok', detail: `${Object.keys(lock.p).length} packages` },
      );
    } catch {
      checks.push({
        id: 'lock',
        status: 'fail',
        detail: 'genpm.lock is invalid',
        fix: 'Restore it from Git; never edit genpm.lock by hand.',
      });
    }
  }
  const registry = registryFor(null, rc, opts.registry);
  try {
    const ms = await new RegistryClient({ registry, fetchImpl: opts.fetchImpl, timeoutMs: 10_000 }).ping();
    checks.push({ id: 'registry', status: ms < 1000 ? 'ok' : 'warn', detail: `${registry} (${ms} ms)` });
  } catch {
    checks.push({
      id: 'registry',
      status: 'fail',
      detail: `${registry} unreachable`,
      fix: 'Check your connection, proxy or GENPM_REGISTRY.',
    });
  }
  try {
    const token = await getToken(registry, { home: opts.home });
    checks.push(
      token
        ? { id: 'login', status: 'ok', detail: 'logged in' }
        : { id: 'login', status: 'warn', detail: 'not logged in', fix: 'Run genpm login (only needed to publish).' },
    );
  } catch (e) {
    checks.push({ id: 'login', status: 'fail', detail: (e as Error).message, fix: (e as { fix?: string }).fix });
  }
  return checks;
}
