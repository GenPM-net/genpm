#!/usr/bin/env node
// BR-15: fuentes self-hosted (sin Google Fonts en runtime). Latín para Instrument Sans (ejes wght y wdth) y
// JetBrains Mono; Noto Sans JP/SC/KR (400 y 600, por unicode-range) solo se cargan en las rutas ja, zh-CN y ko.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const NM = join(ROOT, 'node_modules');
const OUT = join(ROOT, 'public/fonts');
mkdirSync(OUT, { recursive: true });

copyFileSync(
  join(NM, '@fontsource-variable/instrument-sans/files/instrument-sans-latin-standard-normal.woff2'),
  join(OUT, 'instrument-sans-latin.woff2'),
);
for (const w of [400, 700, 800]) {
  copyFileSync(
    join(NM, `@fontsource/jetbrains-mono/files/jetbrains-mono-latin-${w}-normal.woff2`),
    join(OUT, `jetbrains-mono-latin-${w}.woff2`),
  );
}

for (const [locale, pkg] of [
  ['ja', 'noto-sans-jp'],
  ['zh-cn', 'noto-sans-sc'],
  ['ko', 'noto-sans-kr'],
]) {
  const dir = join(OUT, pkg);
  mkdirSync(dir, { recursive: true });
  let css = '';
  for (const w of [400, 600]) {
    const src = readFileSync(join(NM, `@fontsource/${pkg}/${w}.css`), 'utf8');
    css += src.replace(/url\(\.\/files\/([^)]+)\)/g, (_m, file) => {
      if (!existsSync(join(dir, file))) copyFileSync(join(NM, `@fontsource/${pkg}/files/${file}`), join(dir, file));
      return `url(/fonts/${pkg}/${file})`;
    });
  }
  // Solo woff2 (todos los navegadores objetivo): se eliminan las alternativas woff.
  css = css.replace(/,\s*url\([^)]+\.woff\) format\('woff'\)/g, '');
  writeFileSync(join(OUT, `noto-${locale}.css`), css);
}
console.log('✔ fonts → public/fonts');
