#!/usr/bin/env node
// Aprovisiona un registro dedicado (ENT-01, ADR-032, runbook §3.4): D1 propia + Worker en el namespace de Workers for
// Platforms + secretos + (opcional) copia de los datos que el registro ya tenía en el Worker compartido.
//
//   node scripts/provision-dedicated.mjs <slug> --owner <org-de-github> [--copy] [--dry-run]
//
// Requiere: wrangler con sesión en la cuenta, CF_API_TOKEN (Workers Scripts: Edit) y en el entorno los valores de los
// secretos compartidos: SIGNING_KEYS, GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, GITHUB_OAUTH_CLIENT_ID,
// GITHUB_OAUTH_CLIENT_SECRET y CRON_SECRET (el mismo que tiene el Worker compartido). TOKEN_PEPPER se genera nuevo.
// Idempotente en lo posible: si la D1 ya existe, la reutiliza.

import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const NAMESPACE = 'genpm-tenants';
const SHARED_DB = 'genpm-registry';
const args = process.argv.slice(2);
const slug = args[0];
const flag = (n) => args.includes(`--${n}`);
const opt = (n) => {
  const i = args.indexOf(`--${n}`);
  return i > 0 ? args[i + 1] : undefined;
};
const owner = opt('owner');
const dry = flag('dry-run');

if (!slug || !/^[a-z0-9][a-z0-9-]{1,38}$/.test(slug) || !owner) {
  console.error('usage: node scripts/provision-dedicated.mjs <slug> --owner <github-org> [--copy] [--dry-run]');
  process.exit(2);
}
const script = `tenant-${slug}`;
const dbName = `genpm-tenant-${slug}`;
const sql = (v) =>
  v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`;

function wrangler(argv, { json = false } = {}) {
  console.log(`$ wrangler ${argv.join(' ')}`);
  if (dry) return json ? '[]' : '';
  return execFileSync('npx', ['wrangler', ...argv], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
}

function query(db, command, extra = []) {
  const out = wrangler(['d1', 'execute', db, '--remote', '--json', '--command', command, ...extra], { json: true });
  return JSON.parse(out)[0]?.results ?? [];
}

// 1 · D1 del cliente
let databaseId = null;
const list = JSON.parse(wrangler(['d1', 'list', '--json'], { json: true }) || '[]');
databaseId = list.find((d) => d.name === dbName)?.uuid ?? null;
if (!databaseId) {
  const out = wrangler(['d1', 'create', dbName]);
  databaseId =
    out
      .match(/database_id\s*=\s*"([0-9a-f-]{36})"|"database_id":\s*"([0-9a-f-]{36})"/)
      ?.slice(1)
      .find(Boolean) ?? (dry ? '<new-id>' : null);
  if (!databaseId) throw new Error('could not read the new database_id');
}

// 2 · configuración del Worker dedicado: mismo código, sin rutas ni cron, con su D1 y DEDICATED_TENANT
const base = JSON.parse(
  readFileSync(join(ROOT, 'wrangler.jsonc'), 'utf8')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/,(\s*[}\]])/g, '$1'),
);
const cfg = {
  name: script,
  main: '../src/index.ts',
  compatibility_date: base.compatibility_date,
  compatibility_flags: base.compatibility_flags,
  observability: base.observability,
  vars: { ...base.vars, DEDICATED_TENANT: slug },
  d1_databases: [{ binding: 'DB', database_name: dbName, database_id: databaseId, migrations_dir: '../migrations' }],
  ratelimits: base.ratelimits,
};
const cfgDir = join(ROOT, '.tenants');
mkdirSync(cfgDir, { recursive: true });
const cfgPath = join(cfgDir, `${slug}.json`);
writeFileSync(cfgPath, `${JSON.stringify(cfg, null, 2)}\n`);
console.log(`wrote ${cfgPath}`);

// 3 · esquema y despliegue en el namespace
wrangler(['d1', 'migrations', 'apply', dbName, '--remote', '-c', cfgPath]);
wrangler(['deploy', '-c', cfgPath, '--dispatch-namespace', NAMESPACE]);

// 4 · secretos del Worker dedicado (API de Workers for Platforms)
const account = base.vars.CF_ACCOUNT_ID;
const secrets = {
  TOKEN_PEPPER: randomBytes(32).toString('base64url'),
  SIGNING_KEYS: process.env.SIGNING_KEYS,
  GITHUB_APP_ID: process.env.GITHUB_APP_ID,
  GITHUB_APP_PRIVATE_KEY: process.env.GITHUB_APP_PRIVATE_KEY,
  GITHUB_OAUTH_CLIENT_ID: process.env.GITHUB_OAUTH_CLIENT_ID,
  GITHUB_OAUTH_CLIENT_SECRET: process.env.GITHUB_OAUTH_CLIENT_SECRET,
  CRON_SECRET: process.env.CRON_SECRET,
};
for (const [name, text] of Object.entries(secrets)) {
  if (!text) {
    console.warn(`! ${name} not set in the environment: set it later on ${script}`);
    continue;
  }
  console.log(`PUT secret ${name} → ${script}`);
  if (dry) continue;
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${account}/workers/dispatch/namespaces/${NAMESPACE}/scripts/${script}/secrets`,
    {
      method: 'PUT',
      headers: { authorization: `Bearer ${process.env.CF_API_TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ name, text, type: 'secret_text' }),
    },
  );
  if (!res.ok) throw new Error(`secret ${name}: ${res.status} ${await res.text()}`);
}

// 5 · datos: el registro (y, con --copy, todo lo suyo del compartido) en la D1 nueva
const shared = query(SHARED_DB, `SELECT * FROM registries WHERE slug = ${sql(slug)}`)[0];
const regId = shared?.id ?? `reg_${randomUUID().replace(/-/g, '').slice(0, 26)}`;
const inserts = [];
const insertRows = (table, rows) => {
  for (const r of rows) {
    const cols = Object.keys(r);
    inserts.push(
      `INSERT OR IGNORE INTO ${table} (${cols.join(', ')}) VALUES (${cols.map((c) => sql(r[c])).join(', ')});`,
    );
  }
};
if (flag('copy') && shared) {
  const R = sql(regId);
  const pkgs = `SELECT id FROM packages WHERE registry_id = ${R}`;
  const vers = `SELECT id FROM package_versions WHERE package_id IN (${pkgs})`;
  const people = `SELECT owner_id FROM registries WHERE id = ${R} UNION SELECT account_id FROM registry_members WHERE registry_id = ${R}
    UNION SELECT owner_id FROM packages WHERE registry_id = ${R} UNION SELECT created_by FROM packages WHERE registry_id = ${R}
    UNION SELECT published_by FROM package_versions WHERE id IN (${vers}) UNION SELECT owner_id FROM scopes WHERE registry_id = ${R}
    UNION SELECT user_id FROM memberships WHERE org_id IN (SELECT owner_id FROM registries WHERE id = ${R})`;
  // Orden por claves foráneas: cuentas → org → scopes → paquetes → versiones → resto.
  const plan = [
    ['accounts', `SELECT * FROM accounts WHERE id IN (${people})`],
    ['memberships', `SELECT * FROM memberships WHERE org_id IN (${people}) AND user_id IN (${people})`],
    ['scopes', `SELECT * FROM scopes WHERE registry_id = ${R}`],
    ['packages', `SELECT * FROM packages WHERE registry_id = ${R}`],
    ['package_versions', `SELECT * FROM package_versions WHERE package_id IN (${pkgs})`],
    ['package_dependencies', `SELECT * FROM package_dependencies WHERE version_id IN (${vers})`],
    ['dist_tags', `SELECT * FROM dist_tags WHERE package_id IN (${pkgs})`],
    ['package_keywords', `SELECT * FROM package_keywords WHERE package_id IN (${pkgs})`],
    ['packages_fts', `SELECT * FROM packages_fts WHERE package_id IN (${pkgs})`],
    ['packages_fts_cjk', `SELECT * FROM packages_fts_cjk WHERE package_id IN (${pkgs})`],
    ['install_stats_daily', `SELECT * FROM install_stats_daily WHERE package_id IN (${pkgs})`],
    ['teams', `SELECT * FROM teams WHERE org_id IN (${people})`],
    ['team_members', `SELECT * FROM team_members WHERE team_id IN (SELECT id FROM teams WHERE org_id IN (${people}))`],
    ['package_grants', `SELECT * FROM package_grants WHERE package_id IN (${pkgs})`],
    ['registry_members', `SELECT * FROM registry_members WHERE registry_id = ${R}`],
    ['recipes', `SELECT * FROM recipes WHERE registry_id = ${R}`],
    [
      'sso_connections',
      `SELECT * FROM sso_connections WHERE org_id IN (SELECT owner_id FROM registries WHERE id = ${R})`,
    ],
    [
      'sso_identities',
      `SELECT * FROM sso_identities WHERE connection_id IN (SELECT id FROM sso_connections WHERE org_id IN (SELECT owner_id FROM registries WHERE id = ${R}))`,
    ],
    ['audit_log', `SELECT * FROM audit_log WHERE registry_id = ${R}`],
  ];
  // El registro primero (la cuenta dueña va en la primera tabla del plan).
  const [accounts, ...rest] = plan;
  insertRows(accounts[0], query(SHARED_DB, accounts[1]));
  insertRows('registries', [{ ...shared, isolation: 'shared', settings: '{}' }]);
  for (const [table, q] of rest) insertRows(table, query(SHARED_DB, q));
} else {
  // Registro vacío: la org dueña entra como cuenta para poder ser owner; sus miembros llegan al iniciar sesión.
  const gh = dry ? { id: 0, login: owner } : await (await fetch(`https://api.github.com/orgs/${owner}`)).json();
  const accId = `acc_${randomUUID().replace(/-/g, '').slice(0, 26)}`;
  const now = Date.now();
  insertRows('accounts', [
    {
      id: accId,
      kind: 'org',
      handle: gh.login,
      github_id: gh.id,
      github_login: gh.login,
      created_at: now,
      updated_at: now,
    },
  ]);
  inserts.push(
    `INSERT OR IGNORE INTO registries (id, slug, owner_id, plan, is_public, isolation, created_at) VALUES (${sql(regId)}, ${sql(slug)}, (SELECT id FROM accounts WHERE github_id = ${sql(gh.id)}), 'enterprise', 0, 'shared', ${now});`,
  );
}
const dataPath = join(cfgDir, `${slug}.sql`);
writeFileSync(dataPath, `${inserts.join('\n')}\n`);
console.log(`wrote ${dataPath} (${inserts.length} statements)`);
wrangler(['d1', 'execute', dbName, '--remote', '--file', dataPath, '-c', cfgPath]);

// 6 · el compartido enruta a partir de ahora (el registro aparece en su D1 como dedicado)
const now = Date.now();
const routeSql = shared
  ? `UPDATE registries SET isolation = 'dedicated', plan = 'enterprise', settings = json_set(settings, '$.dispatch', json('{"script":"${script}"}')) WHERE id = ${sql(regId)}`
  : `INSERT INTO registries (id, slug, owner_id, plan, is_public, isolation, settings, created_at) VALUES (${sql(regId)}, ${sql(slug)}, NULL, 'enterprise', 0, 'dedicated', '{"dispatch":{"script":"${script}"}}', ${now})`;
wrangler(['d1', 'execute', SHARED_DB, '--remote', '--command', routeSql]);
console.log(`\n✔ ${slug} is dedicated: https://api.genpm.net/r/${slug} → ${NAMESPACE}/${script} (D1 ${dbName})`);
console.log(
  '  Next: check the dispatch binding in wrangler.jsonc (runbook §3.4) and, once verified, purge the old shared rows.',
);
