// Trusted publishing (V03-01, security §4.2): POST /v1/auth/oidc/exchange canjea el token OIDC de GitHub Actions por
// un token `publish` de 15 minutos, restringido a los scopes que autorizaron ese repositorio y solo válido desde él.
// El dueño del scope gestiona las autorizaciones en /v1/scopes/:scope/trusted-publishers.

import type { Context } from 'hono';
import { Hono } from 'hono';
import { z } from 'zod';
import type { Actor, AppEnv } from '../env.js';
import { httpError } from '../http.js';
import { newId } from '../ids.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rate-limit.js';
import { GitHub } from '../services/github.js';
import { verifyGithubOidc, workflowPath } from '../services/oidc.js';
import { hashToken, newToken } from '../services/tokens.js';

const TTL_MS = 15 * 60_000;

type TrustedRow = {
  id: string;
  scope_id: string;
  scope: string;
  owner_id: string;
  repository: string;
  repository_id: string | null;
  workflow: string | null;
  environment: string | null;
  created_at: number;
};

export const oidc = new Hono<AppEnv>().post('/oidc/exchange', rateLimit('exchange'), async (c) => {
  const body = z.strictObject({ token: z.string().min(20).max(8192) }).safeParse(await c.req.json().catch(() => null));
  if (!body.success) throw httpError('E_BAD_REQUEST', { detail: 'token' });
  const claims = await verifyGithubOidc(body.data.token);
  if (!claims) throw httpError('E_AUTH');
  const wf = workflowPath(claims);
  const { results } = await c.env.DB.prepare(
    `SELECT t.id, t.scope_id, s.name AS scope, s.owner_id, t.repository, t.repository_id, t.workflow, t.environment, t.created_at
     FROM trusted_publishers t JOIN scopes s ON s.id = t.scope_id
     WHERE t.registry_id = ?1 AND t.provider = 'github' AND t.repository = ?2`,
  )
    .bind(c.get('tenant').registryId, claims.repository)
    .all<TrustedRow>();
  const matches = results.filter(
    (r) =>
      // Repo recreado con el mismo nombre (repojacking) ⇒ id distinto ⇒ no vale.
      (!r.repository_id || r.repository_id === String(claims.repository_id)) &&
      (!r.workflow || r.workflow === wf) &&
      (!r.environment || r.environment === claims.environment),
  );
  if (!matches.length) throw httpError('E_AUTH');
  // Un token pertenece a una cuenta: la del dueño del primer scope autorizado (y solo sus scopes).
  const owner = matches[0]!.owner_id;
  const scopes = [...new Set(matches.filter((m) => m.owner_id === owner).map((m) => `@${m.scope}`))];
  const token = newToken();
  const now = Date.now();
  const id = newId('tok');
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO api_tokens (id, account_id, name, token_prefix, token_hash, scopes, allowed_packages, repository, expires_at, created_at)
       VALUES (?1, ?2, 'oidc', ?3, ?4, '["read","publish"]', ?5, ?6, ?7, ?8)`,
    ).bind(
      id,
      owner,
      token.slice(0, 8),
      await hashToken(c.env.TOKEN_PEPPER!, token),
      JSON.stringify(scopes.map((s) => `${s}/*`)),
      claims.repository,
      now + TTL_MS,
      now,
    ),
    c.env.DB.prepare(
      "INSERT INTO audit_log (id, registry_id, actor_id, action, target_type, target_id, metadata, created_at) VALUES (?1, ?2, ?3, 'auth.oidc', 'token', ?4, ?5, ?6)",
    ).bind(
      newId('aud'),
      c.get('tenant').registryId,
      owner,
      id,
      JSON.stringify({
        repository: claims.repository,
        workflow: wf,
        ref: claims.ref ?? null,
        run: claims.run_id ?? null,
      }),
      now,
    ),
  ]);
  return c.json({ token, expiresAt: new Date(now + TTL_MS).toISOString(), scopes, repository: claims.repository });
});

/** ¿Puede el actor administrar el scope? (dueño, o owner/admin de la org dueña). */
async function canAdminScope(c: { env: AppEnv['Bindings'] }, actor: Actor, ownerId: string): Promise<boolean> {
  if (ownerId === actor.accountId) return true;
  const m = await c.env.DB.prepare('SELECT role FROM memberships WHERE org_id = ?1 AND user_id = ?2')
    .bind(ownerId, actor.accountId)
    .first<{ role: string }>();
  return !!m && ['owner', 'admin'].includes(m.role);
}

const Add = z.strictObject({
  repository: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/),
  workflow: z
    .string()
    .regex(/^\.github\/workflows\/[A-Za-z0-9_./-]+\.ya?ml$/)
    .nullable()
    .optional(),
  environment: z.string().min(1).max(100).nullable().optional(),
});

const SCOPE = '/:scope{@[a-z0-9][a-z0-9-]*}/trusted-publishers';

async function scopeFor(
  c: Context<AppEnv>,
): Promise<{ id: string; name: string; owner_id: string; git_owner: string }> {
  const actor = c.get('actor')!;
  const name = (c.req.param('scope') ?? '').replace(/^@/, '');
  const scope = await c.env.DB.prepare(
    'SELECT id, name, owner_id, git_owner FROM scopes WHERE registry_id = ?1 AND name = ?2',
  )
    .bind(c.get('tenant').registryId, name)
    .first<{ id: string; name: string; owner_id: string; git_owner: string }>();
  // Sin permiso ⇒ 404: no se revela qué repos están autorizados.
  if (!scope || !(await canAdminScope(c, actor, scope.owner_id))) throw httpError('E_NOT_FOUND', { name });
  return scope;
}

export const trusted = new Hono<AppEnv>()
  .get(SCOPE, requireAuth(), async (c) => {
    const scope = await scopeFor(c);
    const { results } = await c.env.DB.prepare(
      'SELECT id, provider, repository, workflow, environment, created_at FROM trusted_publishers WHERE scope_id = ?1 ORDER BY created_at',
    )
      .bind(scope.id)
      .all<{
        id: string;
        provider: string;
        repository: string;
        workflow: string | null;
        environment: string | null;
        created_at: number;
      }>();
    return c.json({
      scope: `@${scope.name}`,
      publishers: results.map((r) => ({
        ...r,
        created_at: undefined,
        createdAt: new Date(r.created_at).toISOString(),
      })),
    });
  })
  .post(SCOPE, requireAuth('publish'), async (c) => {
    const scope = await scopeFor(c);
    const parsed = Add.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw httpError('E_BAD_REQUEST', { detail: parsed.error.issues[0]?.path.join('.') ?? 'body' });
    const [owner, repoName] = parsed.data.repository.split('/') as [string, string];
    // ADR-018: un scope solo publica desde repos de su dueño de GitHub.
    if (owner.toLowerCase() !== scope.git_owner.toLowerCase())
      throw httpError('E_REPO_NOT_ALLOWED', { repo: parsed.data.repository, scope: `@${scope.name}` });
    const info = await new GitHub(c.env).repo(owner, repoName);
    if (!info) throw httpError('E_REF_NOT_FOUND', { ref: '-', repo: parsed.data.repository });
    const id = newId('tp');
    const now = Date.now();
    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO trusted_publishers (id, registry_id, scope_id, provider, repository, repository_id, workflow, environment, created_by, created_at)
         VALUES (?1, ?2, ?3, 'github', ?4, ?5, ?6, ?7, ?8, ?9) ON CONFLICT DO NOTHING`,
      ).bind(
        id,
        c.get('tenant').registryId,
        scope.id,
        parsed.data.repository,
        String(info.id),
        parsed.data.workflow ?? null,
        parsed.data.environment ?? null,
        c.get('actor')!.accountId,
        now,
      ),
      c.env.DB.prepare(
        "INSERT INTO audit_log (id, registry_id, actor_id, action, target_type, target_id, metadata, created_at) VALUES (?1, ?2, ?3, 'scope.trust', 'scope', ?4, ?5, ?6)",
      ).bind(
        newId('aud'),
        c.get('tenant').registryId,
        c.get('actor')!.accountId,
        scope.id,
        JSON.stringify(parsed.data),
        now,
      ),
    ]);
    return c.json({ ok: true, id }, 201);
  })
  .delete(`${SCOPE}/:id{tp_[0-9A-Za-z]+}`, requireAuth('publish'), async (c) => {
    const scope = await scopeFor(c);
    const r = await c.env.DB.prepare('DELETE FROM trusted_publishers WHERE id = ?1 AND scope_id = ?2')
      .bind(c.req.param('id'), scope.id)
      .run();
    if (!r.meta.changes) throw httpError('E_NOT_FOUND', { name: c.req.param('id') });
    await c.env.DB.prepare(
      "INSERT INTO audit_log (id, registry_id, actor_id, action, target_type, target_id, metadata, created_at) VALUES (?1, ?2, ?3, 'scope.untrust', 'scope', ?4, ?5, ?6)",
    )
      .bind(
        newId('aud'),
        c.get('tenant').registryId,
        c.get('actor')!.accountId,
        scope.id,
        JSON.stringify({ id: c.req.param('id') }),
        Date.now(),
      )
      .run();
    return c.json({ ok: true });
  });
