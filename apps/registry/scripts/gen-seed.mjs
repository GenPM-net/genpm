#!/usr/bin/env node
// Genera seeds/fixtures.sql con 3 paquetes fixture firmados (D2-A-09).
//   SIGNING_KEY_ID=k1 SIGNING_KEYS='{"k1":"…"}' SIGNING_PUBLIC_KEY=… node scripts/gen-seed.mjs > seeds/fixtures.staging.sql
// Sin variables usa la clave de desarrollo `dev1` (solo aceptada por el CLI contra registries locales).
import { DEV_KEY } from './dev-key.mjs';
import { buildSeed } from './seed-lib.mjs';

const keyId = process.env.SIGNING_KEY_ID ?? DEV_KEY.id;
const privateKey = process.env.SIGNING_KEYS ? JSON.parse(process.env.SIGNING_KEYS)[keyId] : DEV_KEY.private;
const publicKey = process.env.SIGNING_PUBLIC_KEY ?? (keyId === DEV_KEY.id ? DEV_KEY.public : undefined);
const sql = await buildSeed({ keyId, privateKey, publicKey });
process.stdout.write(
  `-- Generado por scripts/gen-seed.mjs (${keyId}). Fixtures: @core/db, @core/auth, @core/billing.\n${sql.join(';\n')};\n`,
);
