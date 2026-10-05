// V02-07 / V02-08: deprecar, preferencias, comparar versiones, estado y cola de moderación.
import { env } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import { runCron } from '../src/cron/index.js';
import { FakeGitHub } from './fake-github.js';
import { account, call, seed } from './helpers.js';

let staff: string;
let user: string;
const auth = (t: string, body?: unknown, method = 'POST') => ({
  method,
  headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

beforeAll(async () => {
  await seed();
  staff = (await account({ login: 'mod', staff: true })).token;
  user = (await account({ login: 'someone' })).token;
});

describe('deprecate', () => {
  it('only the owner can deprecate and undo it', async () => {
    expect((await call('/v1/packages/@core/db/deprecate', auth(user, { message: 'use x' }))).status).toBe(404);
    // acc_system es dueño de @core/*; un staff no lo es por serlo.
    await env.DB.prepare(
      "UPDATE packages SET owner_id = (SELECT id FROM accounts WHERE handle = 'someone') WHERE id = 'pkg_fixture03'",
    ).run();
    const r = await call('/v1/packages/@core/billing/deprecate', auth(user, { message: 'Use @core/payments' }));
    expect(r.status).toBe(200);
    const row = await env.DB.prepare(
      "SELECT is_deprecated, deprecation_msg FROM packages WHERE id = 'pkg_fixture03'",
    ).first();
    expect(row).toEqual({ is_deprecated: 1, deprecation_msg: 'Use @core/payments' });
    await call('/v1/packages/@core/billing/deprecate', auth(user, { message: null }));
    expect(await env.DB.prepare("SELECT is_deprecated FROM packages WHERE id = 'pkg_fixture03'").first()).toEqual({
      is_deprecated: 0,
    });
    expect((await call('/v1/packages/@core/billing/deprecate', auth(user, { message: 'x' }))).status).toBe(400);
  });
});

describe('me', () => {
  it('stores the preferred locale and returns daily CLI/MCP series', async () => {
    expect((await call('/v1/me', auth(user, { locale: 'es' }, 'PATCH'))).status).toBe(200);
    expect((await call('/v1/me', auth(user, { locale: 'xx' }, 'PATCH'))).status).toBe(400);
    const me = (await (await call('/v1/me', auth(user, undefined, 'GET'))).json()) as { locale: string };
    expect(me.locale).toBe('es');
    const day = new Date().toISOString().slice(0, 10);
    await env.DB.prepare(
      "INSERT INTO install_stats_daily (package_id, day, installs, via_mcp) VALUES ('pkg_fixture03', ?1, 5, 2) ON CONFLICT DO UPDATE SET installs = 5, via_mcp = 2",
    )
      .bind(day)
      .run();
    const pk = (await (await call('/v1/me/packages', auth(user, undefined, 'GET'))).json()) as {
      packages: Array<{ name: string; daily: Array<{ day: string; cli: number; mcp: number }> }>;
    };
    expect(pk.packages.find((p) => p.name === '@core/billing')!.daily).toContainEqual({ day, cli: 3, mcp: 2 });
  });
});

describe('compare', () => {
  it('returns files inside the package between two versions', async () => {
    const gh = new FakeGitHub();
    gh.compareFiles['genpm-net/db'] = [
      { filename: 'index.ts', status: 'modified', additions: 1, deletions: 1, patch: '@@ -1 +1 @@\n-a\n+b' },
    ];
    const r = await call('/v1/packages/@core/db/compare?from=1.0.0&to=1.0.3', {}, gh);
    expect(r.status).toBe(200);
    const body = (await r.json()) as {
      from: { version: string };
      to: { version: string };
      files: Array<{ path: string }>;
    };
    expect(body.from.version).toBe('1.0.0');
    expect(body.to.version).toBe('1.0.3');
    expect(body.files[0]!.path).toBe('index.ts');
    expect((await call('/v1/packages/@core/db/compare?from=9.9.9', {}, gh)).status).toBe(404);
  });
});

describe('status', () => {
  it('reports components and last cron runs', async () => {
    await runCron('0 4 * * SUN', env);
    const r = await call('/v1/status');
    const body = (await r.json()) as {
      ok: boolean;
      components: Record<string, string>;
      crons: Record<string, { ok: boolean }>;
    };
    expect(body.components.database).toBe('operational');
    expect(body.crons['0 4 * * SUN']!.ok).toBe(true);
  });
});

describe('admin queue', () => {
  it('is staff-only and moderates versions, reports, featured and leads', async () => {
    expect((await call('/v1/admin/queue', auth(user, undefined, 'GET'))).status).toBe(404);
    await env.DB.prepare("UPDATE package_versions SET scan_status = 'flagged' WHERE id = 'ver_fixture0101'").run();
    await env.DB.prepare(
      "INSERT INTO reports (id, package_id, reason, status, created_at) VALUES ('rep_1', 'pkg_fixture01', 'spam', 'open', 1)",
    ).run();
    await env.DB.prepare(
      "INSERT INTO leads (id, kind, email, created_at) VALUES ('lead_1', 'enterprise', 'a@b.co', 1)",
    ).run();
    const q = (await (await call('/v1/admin/queue', auth(staff, undefined, 'GET'))).json()) as {
      versions: Array<{ id: string }>;
      reports: Array<{ id: string }>;
      featured: Array<{ name: string }>;
      leads: Array<{ id: string }>;
    };
    expect(q.versions.map((v) => v.id)).toContain('ver_fixture0101');
    expect(q.reports.map((r) => r.id)).toContain('rep_1');
    expect(q.featured.length).toBeGreaterThan(0);
    expect(q.leads.map((l) => l.id)).toContain('lead_1');
    expect((await call('/v1/admin/versions/ver_fixture0101', auth(staff, { action: 'release' }))).status).toBe(200);
    expect(
      await env.DB.prepare("SELECT scan_status FROM package_versions WHERE id = 'ver_fixture0101'").first(),
    ).toEqual({
      scan_status: 'passed',
    });
    expect((await call('/v1/admin/reports/rep_1', auth(staff, { status: 'dismissed' }))).status).toBe(200);
    expect((await call('/v1/admin/packages/pkg_fixture03/featured', auth(staff, { rank: 4 }))).status).toBe(200);
    expect((await call('/v1/admin/leads/lead_1', auth(staff, { status: 'contacted' }))).status).toBe(200);
    const log = await env.DB.prepare(
      "SELECT count(*) AS n FROM audit_log WHERE action IN ('version.release','report.dismissed','package.featured','lead.contacted')",
    ).first();
    expect(log).toEqual({ n: 4 });
  });
});
