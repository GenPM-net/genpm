#!/usr/bin/env node
// Genera claves Ed25519 de firma de manifiestos (security §4.3, D0-12).
//
//   node scripts/gen-signing-keys.mjs            → k1 (activa), k2 (siguiente) y root (revocación) en ./genpm-keys-<fecha>/
//   node scripts/gen-signing-keys.mjs --dev      → par de desarrollo `dev1` (solo válido contra registries locales)
//
// Producción: ejecútalo en una máquina de confianza, sube k1/k2 con `wrangler secret put SIGNING_KEYS`,
// guarda root.private OFFLINE (nunca en Cloudflare ni en el repo) y fija las claves públicas en packages/core/src/keys.ts.
import { mkdirSync, writeFileSync } from 'node:fs';
import { webcrypto as crypto } from 'node:crypto';

const b64url = (buf) => Buffer.from(buf).toString('base64url');

async function pair() {
  const kp = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  return {
    private: b64url(await crypto.subtle.exportKey('pkcs8', kp.privateKey)),
    public: b64url(await crypto.subtle.exportKey('raw', kp.publicKey)),
  };
}

if (process.argv.includes('--dev')) {
  const dev = await pair();
  console.log(JSON.stringify({ dev1: dev }, null, 2));
  console.log(`\n# .dev.vars\nSIGNING_KEY_ID=dev1\nSIGNING_KEYS={"dev1":"${dev.private}"}`);
  process.exit(0);
}

const dir = `genpm-keys-${new Date().toISOString().slice(0, 10)}`;
mkdirSync(dir, { mode: 0o700 });
const keys = { k1: await pair(), k2: await pair(), root: await pair() };
for (const [id, k] of Object.entries(keys)) {
  writeFileSync(`${dir}/${id}.private`, `${k.private}\n`, { mode: 0o600 });
  writeFileSync(`${dir}/${id}.public`, `${k.public}\n`, { mode: 0o644 });
}
writeFileSync(
  `${dir}/SIGNING_KEYS.secret.json`,
  JSON.stringify({ k1: keys.k1.private, k2: keys.k2.private }),
  { mode: 0o600 },
);
console.log(`Keys written to ./${dir}/ (keep root.private offline).`);
console.log('Pin in packages/core/src/keys.ts:');
console.log(JSON.stringify({ k1: keys.k1.public, k2: keys.k2.public }, null, 2));
console.log(`ROOT_PUBLIC_KEY = '${keys.root.public}'`);
