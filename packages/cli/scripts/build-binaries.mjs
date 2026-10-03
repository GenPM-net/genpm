#!/usr/bin/env node
// Binarios nativos de genpm (ADR-025): genera con tsdown el bundle standalone (dist-standalone/bin.mjs: el de npm más el
// servidor MCP de `genpm mcp serve`) y lo compila con `bun build --compile` para cada plataforma; escribe SHA256SUMS. Bun compila de forma cruzada, así que un solo runner
// produce todo. `--define __GENPM_BINARY_TARGET__` deja grabada en cada binario su plataforma (`genpm upgrade`, `doctor`).
//
//   node scripts/build-binaries.mjs                 # todas las plataformas → dist-bin/
//   node scripts/build-binaries.mjs darwin-arm64    # solo algunas
//
// Requiere `bun` en el PATH (o BUN=/ruta/a/bun) y `pnpm build` previo de las dependencias (@genpm/*).
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const OUT = join(ROOT, 'dist-bin');
const BUN = process.env.BUN ?? 'bun';

// genpm → target de Bun. x64 usa la variante `baseline` (sin AVX2): arranca en cualquier CPU x86-64.
// Mantener en sincronía con BINARY_TARGETS (packages/core/src/self-update.ts) y con scripts/install/install.{sh,ps1}.
const TARGETS = {
  'darwin-arm64': 'bun-darwin-arm64',
  'darwin-x64': 'bun-darwin-x64-baseline',
  'linux-x64': 'bun-linux-x64-baseline',
  'linux-arm64': 'bun-linux-arm64',
  'linux-x64-musl': 'bun-linux-x64-musl-baseline',
  'linux-arm64-musl': 'bun-linux-arm64-musl',
  'windows-x64': 'bun-windows-x64-baseline',
  'windows-arm64': 'bun-windows-arm64',
};

// Mismo tsdown.config.mjs que npm, en modo standalone (incluye @genpm/mcp/serve).
execFileSync(process.execPath, [join(ROOT, 'node_modules', 'tsdown', 'dist', 'run.mjs'), '--config-loader', 'native'], {
  cwd: ROOT,
  env: { ...process.env, GENPM_STANDALONE: '1' },
  stdio: ['ignore', 'ignore', 'inherit'],
});
const entry = join(ROOT, 'dist-standalone', 'bin.mjs');
if (!existsSync(entry)) throw new Error('dist-standalone/bin.mjs was not generated');

const wanted = process.argv.slice(2);
for (const t of wanted)
  if (!(t in TARGETS)) throw new Error(`unknown target ${t} (${Object.keys(TARGETS).join(', ')})`);
const targets = wanted.length ? wanted : Object.keys(TARGETS);

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const sums = [];
for (const target of targets) {
  const file = `genpm-${target}${target.startsWith('windows') ? '.exe' : ''}`;
  const args = [
    'build',
    entry,
    '--compile',
    '--minify',
    `--target=${TARGETS[target]}`,
    `--define=__GENPM_BINARY_TARGET__=${JSON.stringify(target)}`,
    `--outfile=${join(OUT, file)}`,
  ];
  execFileSync(BUN, args, { stdio: ['ignore', 'ignore', 'inherit'] });
  const sha = createHash('sha256')
    .update(readFileSync(join(OUT, file)))
    .digest('hex');
  sums.push(`${sha}  ${file}`);
  console.log(`${file}  ${sha}`);
}
writeFileSync(join(OUT, 'SHA256SUMS'), `${sums.join('\n')}\n`);
