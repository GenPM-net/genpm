// El registro del proyecto (`src/genpm/*`) y todo lo que carga no pueden formar ciclos de imports: funcionan en
// `next dev`, pero en `next start` dejan módulos sin inicializar ("Cannot access 'x' before initialization") y dan 500.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const src = dirname(fileURLToPath(import.meta.url));
const genpm = join(src, 'genpm');

function resolveImport(from: string, spec: string): string | null {
  const base = spec.startsWith('@/') ? join(src, spec.slice(2)) : spec.startsWith('.') ? resolve(dirname(from), spec) : null;
  if (!base) return null;
  for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) if (existsSync(c) && statSync(c).isFile()) return c;
  return null;
}

// Imports estáticos (`import … from`, `export … from`, `import '…'`); los `import()` dinámicos no cuentan.
const importsOf = (file: string) =>
  [...readFileSync(file, 'utf8').matchAll(/^\s*(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|^\s*import\s*['"]([^'"]+)['"]/gm)]
    .map((m) => resolveImport(file, (m[1] ?? m[2])!))
    .filter((f): f is string => !!f);

it('the project registry and everything it loads have no import cycles', () => {
  const cycles: string[] = [];
  const state = new Map<string, 'open' | 'done'>();
  const path: string[] = [];
  const visit = (file: string) => {
    if (state.get(file) === 'done') return;
    if (state.get(file) === 'open') {
      cycles.push([...path.slice(path.indexOf(file)), file].map((f) => relative(src, f)).join(' → '));
      return;
    }
    state.set(file, 'open');
    path.push(file);
    for (const dep of importsOf(file)) visit(dep);
    path.pop();
    state.set(file, 'done');
  };
  for (const f of readdirSync(genpm)) if (/\.tsx?$/.test(f) && !f.includes('.test.')) visit(join(genpm, f));
  expect(state.size).toBeGreaterThan(20);
  expect(cycles).toEqual([]);
});
