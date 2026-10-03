#!/usr/bin/env node
// D5-B-04: `npx genpm` en frío < 2 s. Empaqueta el CLI, lo ejecuta con `npx` y una caché de npm vacía, y comprueba que
// el tarball no declara dependencias (todo va en el bundle). No mide la descarga desde el registro de npm.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const LIMIT_MS = Number(process.env.GENPM_COLD_LIMIT_MS ?? 2000);
const dir = mkdtempSync(join(tmpdir(), 'genpm-cold-'));
const shell = process.platform === 'win32';
try {
  execFileSync('pnpm', ['pack', '--pack-destination', dir], {
    cwd: join(import.meta.dirname, '..'),
    stdio: 'ignore',
    shell,
  });
  const tgz = join(
    dir,
    readdirSync(dir).find((f) => f.endsWith('.tgz')),
  );
  const manifest = JSON.parse(execFileSync('tar', ['xzOf', tgz, 'package/package.json'], { encoding: 'utf8' }));
  if (manifest.dependencies && Object.keys(manifest.dependencies).length) {
    throw new Error(
      `the CLI tarball must have no dependencies, found: ${Object.keys(manifest.dependencies).join(', ')}`,
    );
  }
  const env = { ...process.env, npm_config_cache: join(dir, 'cache'), npm_config_update_notifier: 'false' };
  const start = performance.now();
  const out = execFileSync('npx', ['--yes', `--package=${tgz}`, 'genpm', '--version'], {
    env,
    encoding: 'utf8',
    shell,
  });
  const ms = Math.round(performance.now() - start);
  console.log(`npx genpm --version → ${out.trim()} in ${ms} ms (limit ${LIMIT_MS} ms)`);
  if (ms > LIMIT_MS) process.exit(1);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
