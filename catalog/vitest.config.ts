import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // `@/` como en una app Next (lo usan los kits de src/app y el registro de ejemplo de src/genpm).
  resolve: { alias: { '@/': fileURLToPath(new URL('./src/', import.meta.url)) } },
  esbuild: { jsx: 'automatic' },
  test: { include: ['src/**/*.test.{ts,tsx}'], testTimeout: 30_000, fileParallelism: true },
});
