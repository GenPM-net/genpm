// Genera `src/app/(<kit>)/_templates/genpm.md` con las líneas que cada kit añade a los archivos de registro del
// proyecto (`src/genpm/*.ts`), extraídas del proyecto de ejemplo: las líneas que terminan en `// kit-<nombre>`.
// Uso: node scripts/kit-snippets.mjs [--check]   (--check falla si algún archivo generado está desactualizado)
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const genpmDir = join(root, 'src/genpm');
const cmsTemplates = join(root, 'src/app/(cms)/_templates/genpm');
const check = process.argv.includes('--check');
const kits = readdirSync(join(root, 'src/app')).filter((d) => /^\((?!cms\)).+\)$/.test(d)).map((d) => d.slice(1, -1));
const markRe = /\/\/ (kit-[\w-]+(?: kit-[\w-]+)*)(?::.*)?$/;

/** Dónde va una línea: imports arriba; si no, el array o la declaración que la contiene. */
function placeOf(lines, i) {
  const line = lines[i];
  if (/^import /.test(line)) return 'imports (top of the file)';
  if (/^\S/.test(line)) return 'top level (after the imports)';
  let prop = null;
  for (let j = i - 1; j >= 0; j--) {
    const p = /^\s+(\w+):\s*\[\s*$/.exec(lines[j]);
    if (p && !prop) prop = p[1];
    const c = /^(?:export )?const (\w+)/.exec(lines[j]);
    if (c) return prop ? `\`${c[1]}\` → \`${prop}\` array` : `\`${c[1]}\` (inside its list)`;
  }
  return 'top level';
}

let stale = 0;
for (const kit of kits) {
  const sections = [];
  for (const file of readdirSync(genpmDir).filter((f) => f.endsWith('.ts')).sort()) {
    const lines = readFileSync(join(genpmDir, file), 'utf8').split('\n');
    const groups = new Map();
    lines.forEach((line, i) => {
      const m = markRe.exec(line);
      if (!m || !m[1].split(' ').includes(`kit-${kit}`)) return;
      const place = placeOf(lines, i);
      groups.set(place, [...(groups.get(place) ?? []), line.trim()]);
    });
    if (!groups.size) continue;
    const isNew = !existsSync(join(cmsTemplates, file));
    const body = [...groups].map(([place, ls]) => `${isNew ? '' : `In ${place}:\n\n`}\`\`\`ts\n${ls.join('\n')}\n\`\`\``).join('\n\n');
    sections.push(`## \`src/genpm/${file}\`${isNew ? ' (create it if missing)' : ''}\n\n${body}`);
  }
  if (!sections.length) continue;
  const out = `<!-- Generated from the GenPM catalog example project. -->
# @core/kit-${kit}: lines for \`src/genpm/*.ts\`

Add each line below to the project's registration files (created by @core/kit-cms from its \`_templates/genpm\`).
Skip a line that is already there (another kit may have added it), keep the trailing \`// kit-…\` comment so later
kits and removals can find it, and keep the project's own lines.

${sections.join('\n\n')}
`;
  const target = join(root, 'src/app', `(${kit})`, '_templates', 'genpm.md');
  const current = existsSync(target) ? readFileSync(target, 'utf8') : '';
  if (current === out) continue;
  stale++;
  if (check) console.error(`stale: ${target}`);
  else {
    const { mkdirSync } = await import('node:fs');
    mkdirSync(join(root, 'src/app', `(${kit})`, '_templates'), { recursive: true });
    writeFileSync(target, out);
    console.log(`wrote ${target}`);
  }
}
// Las plantillas de kit-cms deben ser el proyecto de ejemplo sin las líneas de otros kits.
const squash = (t) => t.replace(/\n{3,}/g, '\n\n');
for (const file of readdirSync(cmsTemplates)) {
  const example = readFileSync(join(genpmDir, file), 'utf8').split('\n').filter((l) => !markRe.test(l)).join('\n');
  if (squash(example) !== squash(readFileSync(join(cmsTemplates, file), 'utf8'))) {
    stale++;
    console.error(`kit-cms template differs from src/genpm/${file} without kit lines: ${join(cmsTemplates, file)}`);
  }
}
if (check && stale) {
  console.error('run: node scripts/kit-snippets.mjs');
  process.exit(1);
}
if (check) console.log('✔ kit registration snippets up to date');
