// Escribe genpm.json, LICENSE y .genpmignore de un módulo a partir de scripts/manifests.json.
// Uso: node scripts/meta.mjs <modulo>
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';

const name = process.argv[2];
const all = JSON.parse(readFileSync(new URL('./manifests.json', import.meta.url), 'utf8'));
const m = all[name];
if (!m) throw new Error(`no manifest for ${name}`);
// Los kits viven en src/app/(<kit>) (`d` propio); el resto de módulos en src/lib/<x>.
const d = m.d ?? `src/lib/${name}`;
const dir = new URL(`../${d}/`, import.meta.url);
const manifest = { $: 1, n: `@core/${name}`, v: m.v ?? '1.0.0', s: m.s, d, l: 'MIT', k: m.k };
for (const key of ['g', 'p', 'e', 'm']) if (m[key] && Object.keys(m[key]).length) manifest[key] = m[key];
writeFileSync(new URL('genpm.json', dir), `${JSON.stringify(manifest, null, 2)}\n`);
copyFileSync(new URL('../src/lib/db/LICENSE', import.meta.url), new URL('LICENSE', dir));
copyFileSync(new URL('../src/lib/db/.genpmignore', import.meta.url), new URL('.genpmignore', dir));
console.log(`wrote ${name}`);
