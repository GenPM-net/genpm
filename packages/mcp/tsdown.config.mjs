// Bundle de `npx -y @genpm-net/mcp` (D5-B-04): servidor stdio con todo dentro para arrancar rápido en el cliente de IA.
// `server` se publica también como librería (con tipos) para quien quiera montarlo en otro transporte; `serve` es el
// arranque por stdio que reutiliza `genpm mcp serve` (ADR-025).
import { defineConfig } from 'tsdown';
import { stubCatalogs } from '../cli/tsdown.config.mjs';

export default defineConfig({
  entry: { bin: 'src/bin.ts', server: 'src/server.ts', serve: 'src/serve.ts' },
  format: 'esm',
  platform: 'node',
  target: 'node20.11',
  outDir: 'dist',
  clean: true,
  dts: { resolve: false },
  sourcemap: false,
  minify: true,
  deps: { alwaysBundle: [/.*/] },
  // Los textos para LLMs van siempre en inglés (AGENTS.md): solo `en`, que ya está en el chunk principal.
  plugins: [stubCatalogs(/[\\/]locales[\\/](?!en[\\/])[^\\/]+[\\/]\w+\.json$/)],
});
