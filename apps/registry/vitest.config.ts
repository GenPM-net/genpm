import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';
import { DEV_KEY } from './scripts/dev-key.mjs';

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
          SIGNING_KEY_ID: DEV_KEY.id,
          SIGNING_KEYS: JSON.stringify({ [DEV_KEY.id]: DEV_KEY.private }),
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
