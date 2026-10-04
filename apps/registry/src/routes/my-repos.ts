// Asistente de publicación web (web-ui-spec §5.7): repos públicos del usuario y de sus orgs, y diagnóstico de un repo
// (qué tiene, qué le falta y un genpm.json sugerido). Solo lee: GenPM nunca pide permiso de escritura sobre el repo;
// la web abre GitHub con los archivos prerrellenados y es el usuario quien hace commit.
import { estimateTokens, LIMITS, validateSource } from '@genpm/manifest';
import { type Context, Hono } from 'hono';
import type { AppEnv } from '../env.js';
import { httpError } from '../http.js';
import { requireAuth } from '../middleware/auth.js';
import { GitHub } from '../services/github.js';
import { repoOf } from './util.js';

const WRITE_ROLES = ['owner', 'admin', 'publisher'];
const OWNER_RE = /^[A-Za-z0-9-]{1,39}$/;
const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;
const SEMVER_TAG = /^v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/;

type Owner = { login: string; kind: 'user' | 'org' };
type GhRepo = {
  name: string;
  full_name: string;
  owner: { login: string };
  description: string | null;
  private: boolean;
  fork: boolean;
  archived: boolean;
  default_branch: string;
  pushed_at: string;
  html_url: string;
};

/** Cuentas de GitHub bajo cuyo scope puede publicar el usuario: él mismo y sus orgs con rol de escritura. */
async function owners(c: Context<AppEnv>): Promise<Owner[]> {
  const actor = c.get('actor')!;
  const me = await c.env.DB.prepare('SELECT github_login FROM accounts WHERE id = ?1')
    .bind(actor.accountId)
    .first<{ github_login: string | null }>();
  const { results } = await c.env.DB.prepare(
    `SELECT a.github_login, m.role FROM memberships m JOIN accounts a ON a.id = m.org_id
     WHERE m.user_id = ?1 AND a.kind = 'org' AND a.github_login IS NOT NULL ORDER BY a.github_login`,
  )
    .bind(actor.accountId)
    .all<{ github_login: string; role: string }>();
  const list: Owner[] = me?.github_login ? [{ login: me.github_login, kind: 'user' }] : [];
  for (const r of results) if (WRITE_ROLES.includes(r.role)) list.push({ login: r.github_login, kind: 'org' });
  return list;
}

/** Nombre de paquete sugerido: `@<owner>/<repo>` en minúsculas y con los caracteres que admite el registry. */
function suggestName(owner: string, repo: string): string {
  const slug =
    repo
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'package';
  return `@${owner.toLowerCase()}/${slug}`;
}

export const myRepos = new Hono<AppEnv>()
  .get('/', requireAuth(), async (c) => {
    const gh = new GitHub(c.env);
    const list = await owners(c);
    const repos: Array<{
      owner: string;
      name: string;
      description: string | null;
      pushedAt: string;
      package: string | null;
    }> = [];
    for (const o of list.slice(0, 10)) {
      const path =
        o.kind === 'user'
          ? `/users/${o.login}/repos?type=owner&sort=pushed&per_page=100`
          : `/orgs/${o.login}/repos?type=public&sort=pushed&per_page=100`;
      const rows = (await gh.json<GhRepo[]>(path)) ?? [];
      for (const r of rows) {
        if (r.private || r.archived) continue;
        repos.push({
          owner: r.owner.login,
          name: r.name,
          description: r.description,
          pushedAt: r.pushed_at,
          package: null,
        });
      }
    }
    // Repos que ya son paquetes: se marcan para que el usuario vea dónde publicar una versión nueva.
    if (repos.length) {
      const urls = repos.map((r) => `https://github.com/${r.owner}/${r.name}`.toLowerCase());
      const { results } = await c.env.DB.prepare(
        `SELECT full_name, lower(repo_url) AS url FROM packages WHERE registry_id = ?1 AND lower(repo_url) IN (SELECT value FROM json_each(?2))`,
      )
        .bind(c.get('tenant').registryId, JSON.stringify(urls))
        .all<{ full_name: string; url: string }>();
      const byUrl = new Map(results.map((r) => [r.url, r.full_name]));
      for (const r of repos) r.package = byUrl.get(`https://github.com/${r.owner}/${r.name}`.toLowerCase()) ?? null;
    }
    repos.sort((a, b) => b.pushedAt.localeCompare(a.pushedAt));
    c.header('Cache-Control', 'private, no-store');
    return c.json({ owners: list.map((o) => o.login), repos });
  })
  .get('/:owner/:repo', requireAuth(), async (c) => {
    const owner = c.req.param('owner');
    const name = c.req.param('repo');
    if (!OWNER_RE.test(owner) || !REPO_RE.test(name)) throw httpError('E_BAD_REQUEST', { detail: 'repo' });
    const allowed = await owners(c);
    const match = allowed.find((o) => o.login.toLowerCase() === owner.toLowerCase());
    if (!match) throw httpError('E_FORBIDDEN_SCOPE', { scope: owner.toLowerCase() });
    const gh = new GitHub(c.env);
    const info = await gh.repo(owner, name);
    const repoUrl = `https://github.com/${owner}/${name}`;
    if (!info) throw httpError('E_REF_NOT_FOUND', { ref: 'HEAD', repo: repoUrl });
    if (info.private) throw httpError('E_REPO_NOT_ALLOWED', { repo: repoUrl, scope: owner.toLowerCase() });
    const branch = info.default_branch;
    const sha = await gh.commitSha(owner, name, branch);
    if (!sha) throw httpError('E_REF_NOT_FOUND', { ref: branch, repo: repoUrl });

    // genpm.json de la rama principal: falta, no es válido o es válido.
    const raw = await gh.raw(owner, name, sha, 'genpm.json', 64 * 1024);
    let manifest: {
      status: 'missing' | 'invalid' | 'ok';
      data?: unknown;
      issues?: Array<{ path: string; message: string }>;
    };
    if (raw.status !== 'ok') manifest = { status: raw.status === 'missing' ? 'missing' : 'invalid' };
    else {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw.text);
      } catch {
        parsed = undefined;
      }
      const v = parsed === undefined ? null : validateSource(parsed);
      manifest = !v
        ? { status: 'invalid', issues: [{ path: '', message: 'invalid JSON' }] }
        : v.ok
          ? { status: 'ok', data: v.data }
          : { status: 'invalid', data: parsed, issues: v.issues.map((i) => ({ path: i.path, message: i.message })) };
    }
    const data = manifest.status === 'ok' ? (manifest.data as Record<string, unknown>) : null;
    const rulesPath = typeof data?.['x'] === 'string' ? (data['x'] as string) : 'AGENTS.md';
    const rulesRaw = await gh.raw(owner, name, sha, rulesPath, LIMITS.contextBytes);
    const rules =
      rulesRaw.status === 'ok'
        ? { path: rulesPath, status: 'ok' as const, tokens: estimateTokens(rulesRaw.text) }
        : { path: rulesPath, status: rulesRaw.status };
    const license = await gh.license(owner, name);
    const tagRows = (await gh.json<Array<{ name: string }>>(`/repos/${owner}/${name}/tags?per_page=30`)) ?? [];
    const tags = tagRows.map((t) => t.name);

    const pkgName = typeof data?.['n'] === 'string' ? (data['n'] as string) : suggestName(match.login, name);
    const pkg = await repoOf(c).packageByName(pkgName);
    let published: string[] = [];
    if (pkg) {
      const { results } = await c.env.DB.prepare('SELECT version FROM package_versions WHERE package_id = ?1')
        .bind(pkg.id)
        .all<{ version: string }>();
      published = results.map((r) => r.version);
    }
    const lastTag = tags.map((t) => t.match(SEMVER_TAG)?.[1]).find(Boolean);
    const suggested: Record<string, unknown> = data ?? {
      $: 1,
      n: pkgName,
      v: lastTag && !published.includes(lastTag) ? lastTag : '1.0.0',
      ...(info.description ? { s: { en: info.description.slice(0, 160) } } : {}),
      d: `src/lib/${pkgName.split('/')[1]}`,
      x: 'AGENTS.md',
      ...(license ? { l: license } : {}),
    };
    c.header('Cache-Control', 'private, no-store');
    return c.json({
      repo: { owner: info.owner.login, name: info.name, url: repoUrl, branch, sha, description: info.description },
      manifest,
      rules,
      license,
      tags,
      package: pkg ? { name: pkg.full_name, versions: published } : null,
      suggested,
    });
  });
