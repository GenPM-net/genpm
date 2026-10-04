// Bundle único para `npx @genpm/cli` (architecture §11, roadmap D5-B-04): todo el código (paquetes @genpm/* y dependencias)
// va dentro, así `npx` descarga un solo tarball sin árbol de dependencias. Solo `en` va en el chunk principal; el resto
// de idiomas son chunks que se cargan bajo demanda (i18n §4.1). En .mjs para cargarse igual en Node 20 y 22.
import { defineConfig } from 'tsdown';

/**
 * Catálogos que este binario nunca carga: se sustituyen por un objeto vacío para no inflar el tarball.
 * @param {RegExp} pattern
 */
export const stubCatalogs = (pattern) => ({
  name: 'genpm-stub-catalogs',
  /** @param {string} id */
  load(id) {
    return pattern.test(id) ? '{}' : null;
  },
});

// GENPM_STANDALONE=1 (scripts/build-binaries.mjs): bundle del binario nativo en dist-standalone/, con el servidor MCP
// dentro (`genpm mcp serve`, ADR-025). El paquete de npm lo deja fuera (pesa ~550 KB y alarga el `npx` en frío); desde
// npm/npx, `genpm mcp setup` registra `npx -y @genpm/mcp`, que es el mismo servidor.
const standalone = process.env.GENPM_STANDALONE === '1';

export default defineConfig({
  entry: { bin: 'src/bin.ts' },
  format: 'esm',
  platform: 'node',
  target: 'node20.11',
  outDir: standalone ? 'dist-standalone' : 'dist',
  clean: true,
  dts: false,
  sourcemap: false,
  minify: true,
  deps: standalone
    ? { alwaysBundle: [/.*/] }
    : { alwaysBundle: [/^(?!@genpm\/mcp\/serve$)/], neverBundle: ['@genpm/mcp/serve'] },
  plugins: [stubCatalogs(/[\\/]locales[\\/][^\\/]+[\\/]web\.json$/)],
});
