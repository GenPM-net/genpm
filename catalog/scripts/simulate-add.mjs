// Simula `genpm add <paquete>` desde el workspace (sin registro): resuelve las dependencias `g` de forma transitiva,
// copia cada módulo a su `d` en el proyecto destino respetando `.genpmignore` y muestra las dependencias npm (`p`).
// Uso: node scripts/simulate-add.mjs <proyecto> @core/kit-cms [@core/…]
import { cpSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const [dest, ...wanted] = process.argv.slice(2);
if (!dest || !wanted.length) throw new Error('usage: simulate-add.mjs <project> @core/<name>…');

const dirOf = (name) => {
  const short = name.replace('@core/', '');
  return short.startsWith('kit-') ? join(root, 'src/app', `(${short.slice(4)})`) : join(root, 'src/lib', short);
};
const manifest = (name) => JSON.parse(readFileSync(join(dirOf(name), 'genpm.json'), 'utf8'));

const order = [];
const seen = new Set();
const visit = (name) => {
  if (seen.has(name)) return;
  seen.add(name);
  for (const dep of Object.keys(manifest(name).g ?? {})) visit(dep);
  order.push(name);
};
for (const w of wanted) visit(w);

const ignored = (rel) => /\.test\.tsx?$/.test(rel) || rel.split('/').includes('__fixtures__');
const npm = {};
for (const name of order) {
  const m = manifest(name);
  const src = dirOf(name);
  const to = join(dest, m.d);
  if (existsSync(to)) {
    console.log(`= ${name} already in ${m.d}`);
    continue;
  }
  cpSync(src, to, { recursive: true, filter: (p) => !ignored(relative(src, p)) });
  Object.assign(npm, m.p ?? {});
  console.log(`+ ${name}@${m.v} → ${m.d}`);
}
console.log(`\nnpm dependencies: ${Object.entries(npm).map(([k, v]) => `${k}@${v}`).join(' ')}`);
console.log(`env: ${[...new Set(order.flatMap((n) => manifest(n).e ?? []))].join(', ')}`);
