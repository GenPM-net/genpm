import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      main: './src/index.ts',
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        bindings: {
          ENVIRONMENT: 'test',
          WEB_ORIGIN: 'https://genpm.net',
          TOKEN_PEPPER: 'test-pepper',
          IP_SALT: 'test-salt',
          SIGNING_KEY_ID: 'k1',
          TEST_MIGRATIONS: await readD1Migrations('./migrations'),
        },
      },
    })),
  ],
  test: {
    include: ['test/**/*.test.ts'],
    setupFiles: ['./test/setup.ts'],
  },
});
