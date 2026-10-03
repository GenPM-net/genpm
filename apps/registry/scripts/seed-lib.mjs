// Constructor del seed SQL de fixtures (D2-A-09). Lo usan `scripts/gen-seed.mjs` (staging/local) y los tests.
// Firma cada manifiesto con la clave indicada para que `resolve` sirva `sg` válidos (INV-8).

import { canonicalize, importPrivateKey, manifestHash, parseVersionParts, signManifest } from '@genpm/manifest';

const sha = (seed) => {
  let h = '';
  for (let i = 0; h.length < 40; i++) h += ((seed.charCodeAt(i % seed.length) * (i + 7)) % 16).toString(16);
  return h;
};

export const FIXTURES = [
  {
    $: 1,
    n: '@core/db',
    v: '1.0.0',
    s: {
      en: 'Drizzle client factory, per-module schemas, transactions and ULID ids',
      es: 'Factoría de cliente Drizzle, esquemas por módulo, transacciones e IDs ULID',
      'pt-BR': 'Fábrica de cliente Drizzle, esquemas por módulo, transações e IDs ULID',
    },
    r: 'https://github.com/genpm-net/db',
    t: 'v1.0.0',
    c: sha('db-1.0.0'),
    d: 'src/lib/db',
    i: '.',
    x: 'AGENTS.md',
    l: 'MIT',
    k: ['db', 'drizzle', 'postgres', 'orm'],
    p: { 'drizzle-orm': '^0.44.0', postgres: '^3.4.0' },
    e: ['DATABASE_URL'],
  },
  {
    $: 1,
    n: '@core/db',
    v: '1.0.3',
    s: {
      en: 'Drizzle client factory, per-module schemas, transactions and ULID ids',
      es: 'Factoría de cliente Drizzle, esquemas por módulo, transacciones e IDs ULID',
      'pt-BR': 'Fábrica de cliente Drizzle, esquemas por módulo, transações e IDs ULID',
    },
    r: 'https://github.com/genpm-net/db',
    t: 'v1.0.3',
    c: sha('db-1.0.3'),
    d: 'src/lib/db',
    i: '.',
    x: 'AGENTS.md',
    l: 'MIT',
    k: ['db', 'drizzle', 'postgres', 'orm'],
    p: { 'drizzle-orm': '^0.44.0', postgres: '^3.4.0' },
    e: ['DATABASE_URL'],
  },
  {
    $: 1,
    n: '@core/auth',
    v: '1.2.0',
    s: {
      en: 'Sessions + OAuth (GitHub, Google) with Drizzle',
      es: 'Sesiones + OAuth (GitHub, Google) con Drizzle',
      'pt-BR': 'Sessões + OAuth (GitHub, Google) com Drizzle',
    },
    r: 'https://github.com/genpm-net/auth',
    t: 'v1.2.0',
    c: sha('auth-1.2.0'),
    d: 'src/lib/auth',
    i: '.',
    x: 'AGENTS.md',
    l: 'MIT',
    k: ['auth', 'oauth', 'sessions', 'github'],
    g: { '@core/db': '^1.0.0' },
    p: { arctic: '^3.0.0', '@oslojs/crypto': '^1.0.0', '@oslojs/encoding': '^1.0.0' },
    e: ['AUTH_SECRET', 'GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'],
  },
  {
    $: 1,
    n: '@core/billing',
    v: '1.2.0',
    s: {
      en: 'Stripe subscriptions: checkout, portal and idempotent webhooks with Drizzle',
      es: 'Suscripciones Stripe: checkout, portal y webhooks idempotentes con Drizzle',
      'pt-BR': 'Assinaturas Stripe: checkout, portal e webhooks idempotentes com Drizzle',
    },
    r: 'https://github.com/genpm-net/billing',
    t: 'v1.2.0',
    c: sha('billing-1.2.0'),
    d: 'src/lib/billing',
    i: '.',
    x: 'AGENTS.md',
    l: 'MIT',
    k: ['billing', 'stripe', 'subscriptions', 'webhooks'],
    g: { '@core/auth': '^1.1.0', '@core/db': '^1.0.0' },
    p: { stripe: '^17.0.0' },
    e: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
    m: [{ n: 'stripe', c: 'npx', a: ['-y', '@stripe/mcp', '--tools=all'], e: ['STRIPE_SECRET_KEY'] }],
  },
];

const q = (v) =>
  v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`;

/**
 * @param {{ keyId: string, privateKey: string, publicKey?: string, manifests?: object[], now?: number, rulesFor?: (m: object) => string }} opts
 * @returns {Promise<string[]>} sentencias SQL
 */
export async function buildSeed(opts) {
  const now = opts.now ?? Date.UTC(2026, 9, 1);
  const key = await importPrivateKey(opts.privateKey);
  const manifests = opts.manifests ?? FIXTURES;
  const sql = [];
  if (opts.publicKey) {
    sql.push(
      `INSERT OR IGNORE INTO signing_keys (id, public_key, status, created_at) VALUES (${q(opts.keyId)}, ${q(opts.publicKey)}, 'active', ${now})`,
    );
  }
  const byName = new Map();
  for (const m of manifests) byName.set(m.n, [...(byName.get(m.n) ?? []), m]);
  let i = opts.offset ?? 0;
  for (const [name, versions] of byName) {
    i++;
    const pkgId = `pkg_fixture${String(i).padStart(2, '0')}`;
    const latest = versions[versions.length - 1];
    const short = name.split('/')[1];
    const hasMcp = versions.some((v) => (v.m ?? []).length > 0) ? 1 : 0;
    const latestVerId = `ver_fixture${String(i).padStart(2, '0')}${String(versions.length).padStart(2, '0')}`;
    sql.push(
      `INSERT INTO packages (id, registry_id, scope_id, name, full_name, owner_id, created_by, visibility, summary, repo_url, license, category, latest_version_id, latest_version, has_mcp, is_featured, featured_rank, installs_total, installs_30d, popularity_score, created_at, updated_at) VALUES (${q(pkgId)}, 'reg_public', 'scp_core', ${q(short)}, ${q(name)}, 'acc_system', 'acc_system', 'public', ${q(JSON.stringify(latest.s))}, ${q(latest.r)}, ${q(latest.l)}, ${q(short)}, ${q(latestVerId)}, ${q(latest.v)}, ${hasMcp}, 1, ${i}, ${1000 * i}, ${100 * i}, ${0.1 * i}, ${now}, ${now})`,
    );
    for (const k of latest.k ?? [])
      sql.push(`INSERT INTO package_keywords (package_id, keyword) VALUES (${q(pkgId)}, ${q(k)})`);
    sql.push(
      `INSERT INTO packages_fts (package_id, full_name, summary, keywords) VALUES (${q(pkgId)}, ${q(name)}, ${q(Object.values(latest.s).join(' '))}, ${q((latest.k ?? []).join(' '))})`,
    );
    sql.push(
      `INSERT INTO packages_fts_cjk (package_id, full_name, summary) VALUES (${q(pkgId)}, ${q(name)}, ${q(Object.values(latest.s).join(' '))})`,
    );
    let j = 0;
    for (const m of versions) {
      j++;
      const verId = `ver_fixture${String(i).padStart(2, '0')}${String(j).padStart(2, '0')}`;
      const parts = parseVersionParts(m.v);
      const sg = await signManifest(m, opts.keyId, key);
      const excerpt = opts.rulesFor ? opts.rulesFor(m).slice(0, 2048) : `# ${m.n} — rules for agents\n`;
      sql.push(
        `INSERT INTO package_versions (id, package_id, version, v_major, v_minor, v_patch, v_prerelease, git_ref, commit_sha, dest, include_path, context_path, context_excerpt, manifest, manifest_hash, has_mcp, scan_status, scan_report, status, published_by, published_at, signature) VALUES (${q(verId)}, ${q(pkgId)}, ${q(m.v)}, ${parts.major}, ${parts.minor}, ${parts.patch}, ${q(parts.prerelease)}, ${q(m.t)}, ${q(m.c)}, ${q(m.d)}, ${q(m.i)}, ${q(m.x)}, ${q(excerpt)}, ${q(canonicalize(m))}, ${q(await manifestHash(m))}, ${(m.m ?? []).length ? 1 : 0}, 'passed', '{"status":"passed","findings":[]}', 'active', 'acc_system', ${now + j}, ${q(sg)})`,
      );
      for (const [dep, range] of Object.entries(m.g ?? {})) {
        sql.push(
          `INSERT INTO package_dependencies (version_id, kind, dep_name, dep_range) VALUES (${q(verId)}, 'genpm', ${q(dep)}, ${q(range)})`,
        );
      }
      for (const [dep, range] of Object.entries(m.p ?? {})) {
        sql.push(
          `INSERT INTO package_dependencies (version_id, kind, dep_name, dep_range) VALUES (${q(verId)}, 'npm', ${q(dep)}, ${q(range)})`,
        );
      }
    }
    sql.push(
      `INSERT INTO dist_tags (package_id, tag, version_id, updated_at) VALUES (${q(pkgId)}, 'latest', ${q(latestVerId)}, ${now})`,
    );
  }
  return sql;
}
