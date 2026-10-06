// Tren de versiones: cada módulo que cambia respecto a la base (por defecto origin/main) debe subir su versión
// (`v` de genpm.json) y no puede bajarla. Sustituye a Changesets: los módulos no son paquetes npm sino repos con
// genpm.json; `split-repos.sh` etiqueta cada repo con `v<versión>`. Uso: node scripts/check-versions.mjs [base]
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const base = process.argv[2] ?? 'origin/main';
const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const cmp = (a, b) => {
  const [x, y] = [a, b].map((v) => v.split(/[-+]/)[0].split('.').map(Number));
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
};

const dirs = [
  ...readdirSync(join(root, 'src/lib')).map((d) => `src/lib/${d}`),
  ...readdirSync(join(root, 'src/app')).filter((d) => /^\(.+\)$/.test(d)).map((d) => `src/app/${d}`),
].filter((d) => existsSync(join(root, d, 'genpm.json')));

const changed = new Set(git('diff', '--name-only', `${base}...HEAD`, '--', '.').split('\n').filter(Boolean));
// Tests y fixtures no se publican (.genpmignore): no obligan a subir versión.
const published = (f) => !/\.test\.tsx?$/.test(f) && !f.split('/').includes('__fixtures__');
const errors = [];
for (const d of dirs) {
  const prefix = `catalog/${d}/`;
  if (![...changed].some((f) => f.startsWith(prefix) && published(f))) continue;
  const now = JSON.parse(readFileSync(join(root, d, 'genpm.json'), 'utf8')).v;
  let before;
  try {
    before = JSON.parse(git('show', `${base}:catalog/${d}/genpm.json`)).v;
  } catch {
    continue; // módulo nuevo
  }
  if (cmp(now, before) <= 0) errors.push(`${d}: changed since ${base} but version is ${now} (was ${before}) — bump "v" in genpm.json`);
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`✔ versions bumped for every changed module (base ${base})`);
