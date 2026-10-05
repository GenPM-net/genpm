// POST /v1/publish (api-spec §4.5). INV-7: el registry nunca confía en el manifiesto del cliente; recibe coordenadas
// (repo + ref) y lee la verdad del host (GitHub o GitLab) en el commit resuelto. Cualquier fallo de los pasos 1–10 aborta sin escribir.

import {
  canonicalize,
  checkRef,
  compareVersions,
  createFileFilter,
  DIST_TAG_RE,
  gunzip,
  isPrerelease,
  LIMITS,
  manifestHash,
  normalizeMcp,
  parseName,
  parseVersionParts,
  readTar,
  relativeToInclude,
  type ScanFile,
  type ScanReport,
  SHA1_RE,
  scanTree,
  staticQuality,
  statusOf,
  toResolved,
  typosquatMatches,
  validateSource,
} from '@genpm/manifest';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { z } from 'zod';
import { purgePackage } from '../cache.js';
import type { Actor, AppEnv } from '../env.js';
import { httpError } from '../http.js';
import { newId } from '../ids.js';
import { requireAuth, tokenAllows } from '../middleware/auth.js';
import { clientIp, rateLimit } from '../middleware/rate-limit.js';
import { atLeast, grantOf } from '../services/access.js';
import { archiveVersion } from '../services/archive.js';
import { indexNow } from '../services/indexnow.js';
import { recomputeQuality } from '../services/quality.js';
import { sign } from '../services/signing.js';
import { type SourceHost, sourceHost } from '../services/source-host.js';
import { hashIp } from '../services/tokens.js';
import { repoOf } from './util.js';

const Body = z.strictObject({
  name: z.string().max(110),
  version: z.string().max(64),
  repo: z.string().max(300),
  ref: z.string().max(128),
  manifestPath: z.string().max(200).default('genpm.json'),
  distTag: z.string().regex(DIST_TAG_RE).optional(),
  dryRun: z.boolean().default(false),
  /** V10-01: solo en registros privados (`internal` por defecto); el público siempre es `public`. */
  visibility: z.enum(['public', 'internal', 'private']).optional(),
});

const WRITE_ROLES = ['owner', 'admin', 'publisher'];
const PUBLISH_PER_HOUR = 10;

type Scope = { id: string; name: string; owner_id: string; git_owner: string; is_reserved: number };

/** Paso 2 (ADR-006): permisos sobre el scope o auto-claim si está libre. */
async function authorizeScope(
  c: Context<AppEnv>,
  actor: Actor,
  scopeName: string,
  pkgName: string,
): Promise<{ scope: Scope; claim: Scope | null }> {
  const db = c.env.DB;
  const existing = await repoOf(c).scope(scopeName);
  const priv = c.get('tenant').private;
  if (priv) {
    // Registro privado (V10-01): publican sus admins y publishers; los scopes son del dueño del registro y sus repos
    // tienen que ser del login de GitHub de ese dueño (misma regla ADR-018).
    if (priv.role !== 'admin' && priv.role !== 'publisher') {
      // Un reader con grant `write` sobre el paquete puede publicar versiones nuevas de ese paquete.
      const pkg = existing ? await repoOf(c).packageByName(pkgName) : null;
      if (!pkg || !atLeast(await grantOf(db, pkg.id, priv.principals), 'write'))
        throw httpError('E_FORBIDDEN_SCOPE', { scope: scopeName });
    }
    if (existing) return { scope: existing, claim: null };
    const owner = await db
      .prepare('SELECT id, github_login FROM accounts WHERE id = ?1')
      .bind(priv.ownerId ?? '')
      .first<{ id: string; github_login: string | null }>();
    if (!owner?.github_login) throw httpError('E_FORBIDDEN_SCOPE', { scope: scopeName });
    const claim: Scope = {
      id: newId('scp'),
      name: scopeName,
      owner_id: owner.id,
      git_owner: owner.github_login,
      is_reserved: 0,
    };
    return { scope: claim, claim };
  }
  if (existing) {
    if (existing.is_reserved) {
      // Scopes reservados: solo staff (miembros con rol de escritura de la cuenta de sistema).
      const staff = await db
        .prepare("SELECT role FROM memberships WHERE org_id = 'acc_system' AND user_id = ?1")
        .bind(actor.accountId)
        .first<{ role: string }>();
      if (!staff || !WRITE_ROLES.includes(staff.role)) throw httpError('E_FORBIDDEN_SCOPE', { scope: scopeName });
      return { scope: existing, claim: null };
    }
    if (existing.owner_id === actor.accountId) return { scope: existing, claim: null };
    const m = await db
      .prepare('SELECT role FROM memberships WHERE org_id = ?1 AND user_id = ?2')
      .bind(existing.owner_id, actor.accountId)
      .first<{ role: string }>();
    if (!m || !WRITE_ROLES.includes(m.role)) throw httpError('E_FORBIDDEN_SCOPE', { scope: scopeName });
    return { scope: existing, claim: null };
  }
  // Scope libre: == login de GitHub de la cuenta o de una org de la que es miembro con rol de escritura.
  const own = await db
    .prepare('SELECT id, handle, github_login FROM accounts WHERE id = ?1')
    .bind(actor.accountId)
    .first<{ id: string; github_login: string | null }>();
  let ownerId: string | null = null;
  let gitOwner: string | null = null;
  if (own?.github_login && own.github_login.toLowerCase() === scopeName) {
    ownerId = own.id;
    gitOwner = own.github_login;
  } else {
    const org = await db
      .prepare(
        `SELECT a.id, a.github_login, m.role FROM memberships m JOIN accounts a ON a.id = m.org_id
         WHERE m.user_id = ?1 AND a.kind = 'org' AND lower(a.github_login) = ?2`,
      )
      .bind(actor.accountId, scopeName)
      .first<{ id: string; github_login: string; role: string }>();
    if (org && WRITE_ROLES.includes(org.role)) {
      ownerId = org.id;
      gitOwner = org.github_login;
    }
  }
  if (!ownerId || !gitOwner) throw httpError('E_FORBIDDEN_SCOPE', { scope: scopeName });
  const claim: Scope = { id: newId('scp'), name: scopeName, owner_id: ownerId, git_owner: gitOwner, is_reserved: 0 };
  return { scope: claim, claim };
}

/** Paso 8: árbol del commit (tarball) filtrado por `i` + `.genpmignore` y escaneado con las reglas deterministas. */
async function scanCommit(
  src: SourceHost,
  sha: string,
  include: string,
  contextPath: string,
): Promise<{ report: ScanReport; rules: string | null; allPaths: string[]; gz: Uint8Array }> {
  // Bytes del tar.gz tal cual: se escanean y, si hay bucket, se guardan como Verified Archive (V03-02).
  const gz = new Uint8Array(await new Response(await src.tarball(sha)).arrayBuffer());
  const tar = readTar(
    await gunzip(new Blob([gz]).stream() as ReadableStream<Uint8Array>, LIMITS.packageBytes * 4),
    (_p, size) => size <= LIMITS.fileBytes,
  );
  // codeload antepone `<repo>-<sha>/` a cada ruta (GitLab, `<project>-<sha>-<sha>/`).
  const strip = (p: string) => p.slice(p.indexOf('/') + 1);
  const ignoreEntry = tar.find(
    (e) => e.type === 'file' && relativeToInclude(include, strip(e.path)) === '.genpmignore',
  );
  const included = createFileFilter(ignoreEntry?.content ? new TextDecoder().decode(ignoreEntry.content) : null);
  const files: ScanFile[] = [];
  // Todas las rutas bajo `i`, también las ignoradas: los tests suelen excluirse con .genpmignore (calidad, V02-04).
  const allPaths: string[] = [];
  for (const e of tar) {
    if (e.type === 'dir' || e.type === 'other') continue;
    const rel = relativeToInclude(include, strip(e.path));
    if (rel !== null) allPaths.push(rel);
    if (rel === null || !included(rel)) continue;
    files.push({ path: rel, size: e.size, content: e.content, isSymlink: e.type === 'symlink', mode: e.mode });
  }
  const report = scanTree(files, { contextPath });
  const ctx = files.find((f) => f.path === contextPath);
  const rules = ctx?.content ? new TextDecoder().decode(ctx.content as Uint8Array) : null;
  return { report, rules, allPaths, gz };
}

export const publish = new Hono<AppEnv>().post('/', rateLimit('publish'), requireAuth('publish'), async (c) => {
  const actor = c.get('actor')!;
  const raw = await c.req.json().catch(() => null);
  const parsed = Body.safeParse(raw);
  if (!parsed.success)
    throw httpError('E_BAD_REQUEST', { detail: parsed.error.issues.map((i) => i.path.join('.')).join(', ') });
  const body = parsed.data;
  const db = c.env.DB;
  const tenant = c.get('tenant');
  const repo = repoOf(c);

  // Cuota de publish por cuenta: 10 / hora (api-spec §3), además del binding por minuto.
  const recent = await db
    .prepare(
      "SELECT count(*) AS n FROM audit_log WHERE actor_id = ?1 AND action = 'package.publish' AND created_at > ?2",
    )
    .bind(actor.accountId, Date.now() - 3_600_000)
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= PUBLISH_PER_HOUR) throw httpError('E_RATE_LIMITED', { seconds: 3600 });

  // 1–2 · nombre y permisos sobre el scope
  const parts = parseName(body.name);
  if (!parts) throw httpError('E_BAD_REQUEST', { detail: 'name' });
  // Tokens restringidos (`allowed_packages`, trusted publishing): fuera de su lista no pueden publicar.
  if (!tokenAllows(actor, body.name)) throw httpError('E_FORBIDDEN_SCOPE', { scope: parts.scope });
  const { scope, claim } = await authorizeScope(c, actor, parts.scope, body.name);

  // 3 · el repo pertenece al owner de GitHub del scope; GitLab (V03-03, ADR-028) solo vía trusted publishing, porque
  // la autorización del proyecto la dio el dueño del scope al registrarlo como editor de confianza.
  const src = sourceHost(c.env, body.repo);
  const repoNotAllowed = () => httpError('E_REPO_NOT_ALLOWED', { repo: body.repo, scope: parts.scope });
  if (!src) throw repoNotAllowed();
  if (src.kind === 'github' && src.owner.toLowerCase() !== scope.git_owner.toLowerCase()) throw repoNotAllowed();
  if (src.kind === 'gitlab' && (claim || !actor.repository)) throw repoNotAllowed();
  // Trusted publishing: el token OIDC solo vale para el repositorio que lo pidió.
  if (actor.repository && actor.repository.toLowerCase() !== src.identity.toLowerCase()) throw repoNotAllowed();
  const info = await src.repo();
  if (!info) throw httpError('E_REF_NOT_FOUND', { ref: body.ref, repo: body.repo });
  // Repos privados solo en registros privados (V10-01), leídos con la instalación de la GitHub App del dueño.
  if (info.private && !tenant.private) throw repoNotAllowed();
  const visibility = tenant.private ? (body.visibility ?? 'internal') : 'public';
  if (tenant.private ? visibility === 'public' : body.visibility && body.visibility !== 'public')
    throw httpError('E_BAD_REQUEST', { detail: 'visibility' });

  // 4 · ref inmutable: tag existente o SHA de 40; nunca rama
  if (checkRef(body.ref)) throw httpError('E_REF_MUTABLE', { ref: body.ref });
  const isSha = SHA1_RE.test(body.ref);
  if (!isSha) {
    if (!(await src.isTag(body.ref))) {
      if (await src.isBranch(body.ref)) throw httpError('E_REF_MUTABLE', { ref: body.ref });
      throw httpError('E_REF_NOT_FOUND', { ref: body.ref, repo: body.repo });
    }
  }

  // 5 · ref → SHA `c`; repojacking: el id numérico del repo no puede cambiar entre versiones
  const sha = await src.commitSha(body.ref);
  if (!sha) throw httpError('E_REF_NOT_FOUND', { ref: body.ref, repo: body.repo });
  if (isSha && sha !== body.ref) throw httpError('E_REF_NOT_FOUND', { ref: body.ref, repo: body.repo });
  const existing = await repo.packageByName(body.name);
  if (existing?.git_repo_id && existing.git_repo_id !== info.id) throw httpError('E_REPO_CHANGED', { name: body.name });
  // Cambiar de host (GitHub ↔ GitLab) también es otro repositorio: los ids numéricos no son comparables entre hosts.
  if (existing && sourceHost(c.env, existing.repo_url)?.kind !== src.kind)
    throw httpError('E_REPO_CHANGED', { name: body.name });

  // 6 · manifiesto leído del host en `c` (nunca del cliente)
  const manifestFile = await src.raw(sha, body.manifestPath, 64 * 1024);
  if (manifestFile.status !== 'ok')
    throw httpError('E_MANIFEST_INVALID', {}, { issues: [{ path: body.manifestPath, message: manifestFile.status }] });
  let source: unknown;
  try {
    source = JSON.parse(manifestFile.text);
  } catch {
    throw httpError('E_MANIFEST_INVALID', {}, { issues: [{ path: body.manifestPath, message: 'invalid JSON' }] });
  }
  const v = validateSource(source);
  if (!v.ok)
    throw httpError(
      v.code,
      { path: body.manifestPath, reason: v.issues[0]?.message ?? '', ref: body.ref },
      { issues: v.issues },
    );
  const m = v.data;
  if (m.n !== body.name) throw httpError('E_NAME_MISMATCH', { actual: m.n, expected: body.name });
  if (m.v !== body.version)
    throw httpError('E_NAME_MISMATCH', { actual: `${m.n}@${m.v}`, expected: `${body.name}@${body.version}` });
  if (m.t && m.t !== body.ref && m.t !== sha) throw httpError('E_REF_NOT_FOUND', { ref: m.t, repo: body.repo });

  // 7 · inmutabilidad (INV-9): (registry, n, v) no puede existir, ni siquiera retirada
  if (existing && (await repo.version(existing.id, m.v)))
    throw httpError('E_VERSION_EXISTS', { name: m.n, version: m.v });

  // 8 · reglas `x` y escaneo del árbol del commit
  const include = m.i ?? '.';
  const contextPath = m.x ?? 'AGENTS.md';
  const { report, rules, allPaths, gz } = await scanCommit(src, sha, include, contextPath);
  const warnings: Array<{ code: string; detail: string }> = [];
  if (rules === null) {
    if (m.x) throw httpError('E_CONTEXT_MISSING', { path: contextPath });
    warnings.push({ code: 'W_CONTEXT_MISSING', detail: contextPath });
  } else if (new TextEncoder().encode(rules).length > LIMITS.contextBytes) {
    throw httpError('E_CONTEXT_TOO_LARGE', { path: contextPath });
  }
  if (report.status === 'failed') {
    const autorun = report.findings.filter((f) => f.rule === 'autorun').map((f) => f.path);
    if (autorun.length)
      throw httpError('E_AUTORUN_FILE', { name: m.n, files: autorun.join(', ') }, { findings: report.findings });
    const first = report.findings.find((f) => f.severity === 'fail')!;
    throw httpError(
      'E_SCAN_FAILED',
      { name: m.n, detail: `${first.rule}${first.path ? ` (${first.path})` : ''}` },
      { findings: report.findings },
    );
  }

  // 9 · licencia: prevalece la detectada por el host
  const ghLicense = await src.license();
  const license = ghLicense ?? m.l ?? 'NOASSERTION';
  if (ghLicense && m.l && ghLicense !== m.l)
    warnings.push({ code: 'W_LICENSE_MISMATCH', detail: `${m.l} → ${ghLicense}` });

  // 10 · typosquatting contra el top-100 de otros scopes ⇒ cuarentena
  const { results: top } = await db
    .prepare(
      "SELECT full_name FROM packages WHERE registry_id = ?1 AND visibility = 'public' AND status = 'active' ORDER BY installs_30d DESC LIMIT 100",
    )
    .bind(tenant.registryId)
    .all<{ full_name: string }>();
  const squats = tenant.private
    ? []
    : typosquatMatches(
        m.n,
        top.map((t) => t.full_name),
      );
  const findings = [...report.findings];
  if (squats.length) findings.push({ rule: 'typosquat', severity: 'flag', detail: `${squats.join(', ')}` });
  const scanStatus = statusOf(findings);

  // 11 · manifiesto resuelto canónico + firma; batch atómico
  const resolved = toResolved(m, {
    r: src.url,
    t: isSha ? sha : body.ref,
    c: sha,
    l: license,
  });
  const canonical = canonicalize(resolved);
  const sg = await sign(c.env, resolved);
  const hash = await manifestHash(resolved);
  const v3 = parseVersionParts(m.v);
  const now = Date.now();
  const pkgId = existing?.id ?? newId('pkg');
  const verId = newId('ver');
  const hasMcp = (m.m ?? []).length > 0 ? 1 : 0;
  const quarantined = scanStatus === 'flagged';
  const distTag = body.distTag ?? (isPrerelease(m.v) ? 'next' : 'latest');
  const currentTag = existing ? (await repo.distTags(existing.id))[distTag] : undefined;
  const moveTag = !quarantined && (!currentTag || compareVersions(m.v, currentTag) > 0);
  const becomesLatest = moveTag && distTag === 'latest';
  const summary = m.s === undefined ? null : JSON.stringify(typeof m.s === 'string' ? { en: m.s } : m.s);
  const summaryText = m.s === undefined ? '' : typeof m.s === 'string' ? m.s : Object.values(m.s).join(' ');
  const ipHash = c.env.IP_SALT ? await hashIp(c.env.IP_SALT, clientIp(c.req.raw)) : null;

  if (body.dryRun) {
    return c.json({
      manifest: { ...resolved, sg },
      scan: { status: scanStatus, findings },
      warnings,
      url: `${c.env.WEB_ORIGIN}/p/${m.n}`,
      dryRun: true,
    });
  }

  const stmts: D1PreparedStatement[] = [];
  if (claim) {
    stmts.push(
      db
        .prepare(
          'INSERT INTO scopes (id, registry_id, name, owner_id, git_host, git_owner, is_reserved, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, ?7)',
        )
        .bind(claim.id, tenant.registryId, claim.name, claim.owner_id, src.host, claim.git_owner, now),
    );
  }
  if (!existing) {
    stmts.push(
      db
        .prepare(
          `INSERT INTO packages (id, registry_id, scope_id, name, full_name, owner_id, created_by, visibility, summary, repo_url, git_repo_id, license,
             latest_version_id, latest_version, has_mcp, status, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?17, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?16)`,
        )
        .bind(
          pkgId,
          tenant.registryId,
          scope.id,
          parts.name,
          m.n,
          scope.owner_id,
          actor.accountId,
          summary,
          resolved.r,
          info.id,
          license,
          becomesLatest ? verId : null,
          becomesLatest ? m.v : null,
          hasMcp,
          'active',
          now,
          visibility,
        ),
    );
  } else if (becomesLatest) {
    stmts.push(
      db
        .prepare(
          'UPDATE packages SET summary = ?1, repo_url = ?2, git_repo_id = ?3, license = ?4, latest_version_id = ?5, latest_version = ?6, has_mcp = ?7, updated_at = ?8 WHERE id = ?9',
        )
        .bind(summary, resolved.r, info.id, license, verId, m.v, hasMcp, now, pkgId),
    );
  } else {
    stmts.push(
      db.prepare('UPDATE packages SET git_repo_id = ?1, updated_at = ?2 WHERE id = ?3').bind(info.id, now, pkgId),
    );
  }
  stmts.push(
    db
      .prepare(
        `INSERT INTO package_versions (id, package_id, version, v_major, v_minor, v_patch, v_prerelease, git_ref, commit_sha, dest, include_path, context_path,
           context_excerpt, manifest, manifest_hash, has_mcp, scan_status, scan_report, status, published_by, published_at, signature)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22)`,
      )
      .bind(
        verId,
        pkgId,
        m.v,
        v3.major,
        v3.minor,
        v3.patch,
        v3.prerelease,
        resolved.t,
        sha,
        resolved.d,
        resolved.i,
        resolved.x,
        rules ? rules.slice(0, 2048) : null,
        canonical,
        hash,
        hasMcp,
        scanStatus,
        JSON.stringify({
          status: scanStatus,
          findings,
          files: report.files,
          bytes: report.bytes,
          rulesTokens: report.rulesTokens,
          quality: staticQuality({ license, rules, paths: allPaths }),
        }),
        quarantined ? 'quarantined' : 'active',
        actor.accountId,
        now,
        sg,
      ),
  );
  for (const [dep, range] of Object.entries(m.g ?? {})) {
    stmts.push(
      db
        .prepare(
          "INSERT INTO package_dependencies (version_id, kind, dep_name, dep_range) VALUES (?1, 'genpm', ?2, ?3)",
        )
        .bind(verId, dep, range),
    );
  }
  for (const [dep, range] of Object.entries(m.p ?? {})) {
    stmts.push(
      db
        .prepare("INSERT INTO package_dependencies (version_id, kind, dep_name, dep_range) VALUES (?1, 'npm', ?2, ?3)")
        .bind(verId, dep, range),
    );
  }
  if (moveTag) {
    stmts.push(
      db
        .prepare(
          'INSERT INTO dist_tags (package_id, tag, version_id, updated_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT (package_id, tag) DO UPDATE SET version_id = ?3, updated_at = ?4',
        )
        .bind(pkgId, distTag, verId, now),
    );
  }
  if (becomesLatest || !existing) {
    stmts.push(db.prepare('DELETE FROM package_keywords WHERE package_id = ?1').bind(pkgId));
    for (const k of m.k ?? [])
      stmts.push(db.prepare('INSERT INTO package_keywords (package_id, keyword) VALUES (?1, ?2)').bind(pkgId, k));
    stmts.push(db.prepare('DELETE FROM packages_fts WHERE package_id = ?1').bind(pkgId));
    stmts.push(
      db
        .prepare('INSERT INTO packages_fts (package_id, full_name, summary, keywords) VALUES (?1, ?2, ?3, ?4)')
        .bind(pkgId, m.n, summaryText, (m.k ?? []).join(' ')),
    );
    stmts.push(db.prepare('DELETE FROM packages_fts_cjk WHERE package_id = ?1').bind(pkgId));
    stmts.push(
      db
        .prepare('INSERT INTO packages_fts_cjk (package_id, full_name, summary) VALUES (?1, ?2, ?3)')
        .bind(pkgId, m.n, summaryText),
    );
  }
  stmts.push(
    db
      .prepare(
        "INSERT INTO audit_log (id, registry_id, actor_id, action, target_type, target_id, ip_hash, metadata, created_at) VALUES (?1, ?2, ?3, 'package.publish', 'version', ?4, ?5, ?6, ?7)",
      )
      .bind(
        newId('aud'),
        tenant.registryId,
        actor.accountId,
        verId,
        ipHash,
        JSON.stringify({ n: m.n, v: m.v, c: sha, scan: scanStatus, mcp: (m.m ?? []).map((e) => normalizeMcp(e).n) }),
        now,
      ),
  );
  try {
    await db.batch(stmts);
  } catch (e) {
    // Carrera entre dos publish de la misma versión: UNIQUE(package_id, version) gana (INV-9).
    if (String(e).includes('UNIQUE')) throw httpError('E_VERSION_EXISTS', { name: m.n, version: m.v });
    throw e;
  }

  // 12 · purga de caché + escaneo profundo en cola
  c.executionCtx.waitUntil(purgePackage(c, m.n));
  // Paquete nuevo o versión nueva: que los buscadores (y los agentes que buscan en la web) lo vean ya.
  if (!tenant.private) c.executionCtx.waitUntil(indexNow(c.env, [`/p/${m.n}`, `/p/${m.n}.md`, '/llms.txt', '/search']));
  c.executionCtx.waitUntil(recomputeQuality(c.env, pkgId).catch(() => 0));
  c.executionCtx.waitUntil(archiveVersion(c.env, { verId, n: m.n, v: m.v, c: sha, gz }).catch(() => undefined));
  if (c.env.SCAN_QUEUE) c.executionCtx.waitUntil(c.env.SCAN_QUEUE.send({ versionId: verId, name: m.n, version: m.v }));

  return c.json(
    {
      manifest: { ...resolved, sg },
      scan: { status: scanStatus, findings },
      warnings,
      url: `${c.env.WEB_ORIGIN}/p/${m.n}`,
    },
    201,
  );
});
