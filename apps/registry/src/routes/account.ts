// Gestión de la cuenta desde la web (api-spec §4): tokens (crear se muestra una vez, revocar), paquetes y actividad
// propios (dashboard), reportes de paquetes y leads de sponsors/enterprise.
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../env.js';
import { httpError } from '../http.js';
import { newId } from '../ids.js';
import { requireAuth } from '../middleware/auth.js';
import { clientIp, rateLimit } from '../middleware/rate-limit.js';
import { hashIp, hashToken, newToken } from '../services/tokens.js';
import { repoOf } from './util.js';

const CreateToken = z.strictObject({
  name: z.string().trim().min(1).max(64),
  scopes: z
    .array(z.enum(['read', 'publish']))
    .min(1)
    .max(2),
  days: z.union([z.literal(30), z.literal(90), z.literal(365)]).default(30),
  packages: z
    .array(z.string().regex(/^@[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*$/))
    .max(20)
    .optional(),
});

export const tokens = new Hono<AppEnv>()
  .get('/', requireAuth(), async (c) => {
    const { results } = await c.env.DB.prepare(
      'SELECT id, name, token_prefix, scopes, allowed_packages, expires_at, last_used_at, created_at FROM api_tokens WHERE account_id = ?1 AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 100',
    )
      .bind(c.get('actor')!.accountId)
      .all<{
        id: string;
        name: string;
        token_prefix: string;
        scopes: string;
        allowed_packages: string | null;
        expires_at: number | null;
        last_used_at: number | null;
        created_at: number;
      }>();
    const iso = (n: number | null) => (n ? new Date(n).toISOString() : null);
    return c.json({
      tokens: results.map((r) => ({
        id: r.id,
        name: r.name,
        prefix: r.token_prefix,
        scopes: JSON.parse(r.scopes) as string[],
        packages: r.allowed_packages ? (JSON.parse(r.allowed_packages) as string[]) : null,
        expiresAt: iso(r.expires_at),
        lastUsedAt: iso(r.last_used_at),
        createdAt: iso(r.created_at),
      })),
    });
  })
  .post('/', requireAuth('web'), async (c) => {
    const parsed = CreateToken.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw httpError('E_BAD_REQUEST', { detail: parsed.error.issues[0]?.path.join('.') ?? 'body' });
    const actor = c.get('actor')!;
    const token = newToken();
    const now = Date.now();
    const id = newId('tok');
    const expires = now + parsed.data.days * 86_400_000;
    await c.env.DB.batch([
      c.env.DB.prepare(
        'INSERT INTO api_tokens (id, account_id, name, token_prefix, token_hash, scopes, allowed_packages, expires_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)',
      ).bind(
        id,
        actor.accountId,
        parsed.data.name,
        token.slice(0, 8),
        await hashToken(c.env.TOKEN_PEPPER!, token),
        JSON.stringify(parsed.data.scopes),
        parsed.data.packages ? JSON.stringify(parsed.data.packages) : null,
        expires,
        now,
      ),
      c.env.DB.prepare(
        "INSERT INTO audit_log (id, registry_id, actor_id, action, target_type, target_id, created_at) VALUES (?1, ?2, ?3, 'token.create', 'token', ?4, ?5)",
      ).bind(newId('aud'), c.get('tenant').registryId, actor.accountId, id, now),
    ]);
    // El token en claro solo se devuelve aquí, una vez.
    return c.json({ id, token, expiresAt: new Date(expires).toISOString() }, 201);
  })
  .delete('/:id{tok_[0-9A-Z]{26}}', requireAuth('web'), async (c) => {
    const actor = c.get('actor')!;
    const r = await c.env.DB.prepare(
      'UPDATE api_tokens SET revoked_at = ?1 WHERE id = ?2 AND account_id = ?3 AND revoked_at IS NULL',
    )
      .bind(Date.now(), c.req.param('id'), actor.accountId)
      .run();
    if (!r.meta.changes) throw httpError('E_NOT_FOUND', { name: c.req.param('id') });
    return c.json({ ok: true });
  });

export const myPackages = new Hono<AppEnv>()
  .get('/packages', requireAuth(), async (c) => {
    const actor = c.get('actor')!;
    const { results } = await c.env.DB.prepare(
      `SELECT p.full_name AS name, p.latest_version AS version, p.installs_30d AS installs30d, p.status, v.scan_status AS scan
       FROM packages p LEFT JOIN package_versions v ON v.id = p.latest_version_id
       WHERE p.registry_id = ?1 AND (p.owner_id = ?2 OR p.owner_id IN (SELECT org_id FROM memberships WHERE user_id = ?2 AND role IN ('owner','admin','publisher')))
       ORDER BY p.updated_at DESC LIMIT 100`,
    )
      .bind(c.get('tenant').registryId, actor.accountId)
      .all();
    return c.json({ packages: results });
  })
  .get('/activity', requireAuth(), async (c) => {
    const { results } = await c.env.DB.prepare(
      'SELECT action, target_type, metadata, created_at FROM audit_log WHERE actor_id = ?1 ORDER BY created_at DESC LIMIT 30',
    )
      .bind(c.get('actor')!.accountId)
      .all<{ action: string; target_type: string; metadata: string | null; created_at: number }>();
    return c.json({
      activity: results.map((r) => ({
        action: r.action,
        target: r.target_type,
        metadata: r.metadata ? JSON.parse(r.metadata) : null,
        at: new Date(r.created_at).toISOString(),
      })),
    });
  });

const Report = z.strictObject({
  name: z.string().regex(/^@[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*$/),
  version: z.string().max(64).optional(),
  reason: z.enum(['malware', 'prompt_injection', 'spam', 'typosquat', 'license', 'other']),
  details: z.string().max(2000).optional(),
});

export const reports = new Hono<AppEnv>().post('/', requireAuth(), async (c) => {
  const parsed = Report.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw httpError('E_BAD_REQUEST', { detail: parsed.error.issues[0]?.path.join('.') ?? 'body' });
  const repo = repoOf(c);
  const pkg = await repo.packageByName(parsed.data.name);
  if (!pkg) throw httpError('E_NOT_FOUND', { name: parsed.data.name });
  const ver = parsed.data.version ? await repo.version(pkg.id, parsed.data.version) : null;
  const id = newId('rep');
  await c.env.DB.prepare(
    'INSERT INTO reports (id, package_id, version_id, reporter_id, reason, details, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)',
  )
    .bind(
      id,
      pkg.id,
      ver?.id ?? null,
      c.get('actor')!.accountId,
      parsed.data.reason,
      parsed.data.details ?? null,
      Date.now(),
    )
    .run();
  return c.json({ id }, 201);
});

const Lead = z.strictObject({
  kind: z.enum(['sponsor', 'enterprise']),
  email: z.string().email().max(254),
  company: z.string().max(120).optional(),
  details: z.record(z.string(), z.string().max(500)).optional(),
  /** Honeypot: los humanos lo dejan vacío. */
  website: z.string().max(0).optional(),
});

export const leads = new Hono<AppEnv>().post('/', rateLimit('exchange'), async (c) => {
  const parsed = Lead.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw httpError('E_BAD_REQUEST', { detail: parsed.error.issues[0]?.path.join('.') ?? 'body' });
  const d = parsed.data;
  await c.env.DB.prepare(
    'INSERT INTO leads (id, kind, email, company, details, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)',
  )
    .bind(
      newId('lead'),
      d.kind,
      d.email,
      d.company ?? null,
      JSON.stringify({ ...d.details, ip: c.env.IP_SALT ? await hashIp(c.env.IP_SALT, clientIp(c.req.raw)) : null }),
      Date.now(),
    )
    .run();
  return c.json({ ok: true }, 201);
});
