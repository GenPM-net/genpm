#!/usr/bin/env node
// Firma la lista de revocación de claves con la clave raíz OFFLINE (security §4.3, runbook docs/runbook.md §2).
// Ejecútalo en la máquina de confianza donde vive root.private; nunca subas root.private a Cloudflare ni al repo.
//
//   node scripts/sign-revocation.mjs --root ./genpm-keys-2026-10-03/root.private --revoke k1 [--revoke k0] [--previous lista.json]
//
// Imprime la lista firmada (JSON) y la sentencia SQL para publicarla en D1 (`registry_meta.revocation_list`).
// Con --previous se conservan las claves ya revocadas: una lista nueva nunca "des-revoca" (los clientes tampoco lo harían).
import { readFileSync } from 'node:fs';
import { importPrivateKey, revocationPayload, signBytes } from '../packages/manifest/dist/index.js';

const args = process.argv.slice(2);
const values = (flag) => args.flatMap((a, i) => (a === flag ? [args[i + 1]] : []));
const [rootFile] = values('--root');
if (!rootFile || values('--revoke').length === 0) {
  console.error(
    'usage: sign-revocation.mjs --root <root.private> --revoke <keyid> [--revoke <keyid>] [--previous <list.json>]',
  );
  process.exit(2);
}
const previous = values('--previous').flatMap((f) => JSON.parse(readFileSync(f, 'utf8')).revoked ?? []);
const revoked = [...new Set([...previous, ...values('--revoke')])].sort();
const base = { v: 1, issuedAt: Date.now(), revoked };
const key = await importPrivateKey(readFileSync(rootFile, 'utf8').trim());
const list = { ...base, sig: await signBytes(key, revocationPayload(base)) };
const json = JSON.stringify(list);
console.log(json);
console.log(
  `\n-- D1 (wrangler d1 execute genpm-registry --remote --command "...")\nINSERT INTO registry_meta (key, value, updated_at) VALUES ('revocation_list', '${json}', ${base.issuedAt}) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;`,
);
