// Configuración de drizzle-kit para TODA la app: recoge el `schema.ts` de cada módulo de src/lib, así que añadir un
// módulo no exige editar este archivo. Uso: `npx drizzle-kit generate --config src/lib/db/drizzle.config.ts`.
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/lib/*/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
  strict: true,
  verbose: true,
});
