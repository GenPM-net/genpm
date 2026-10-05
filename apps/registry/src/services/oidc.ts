// Verificación de tokens OIDC de CI (V03-01 GitHub Actions, V03-03 GitLab CI). RS256 contra el JWKS público del
// emisor, con `iss`, `aud` y `exp` comprobados. Sin dependencias: WebCrypto del runtime.

export const GITHUB_ISSUER = 'https://token.actions.githubusercontent.com';
export const GITLAB_ISSUER = 'https://gitlab.com';
/** Audiencia que el CLI pide a Actions (`core.getIDToken('genpm')`) y que GitLab declara en `id_tokens: aud`. */
export const OIDC_AUDIENCE = 'genpm';

const JWKS_URL: Record<string, string> = {
  [GITHUB_ISSUER]: `${GITHUB_ISSUER}/.well-known/jwks`,
  [GITLAB_ISSUER]: `${GITLAB_ISSUER}/oauth/discovery/keys`,
};

type BaseClaims = { iss: string; aud: string | string[]; exp: number; nbf?: number; iat?: number; sub: string };

export type GithubClaims = BaseClaims & {
  repository: string;
  repository_id: string;
  repository_owner: string;
  /** `owner/repo/.github/workflows/release.yml@refs/tags/v1.0.0` */
  job_workflow_ref?: string;
  workflow_ref?: string;
  environment?: string;
  ref?: string;
  sha?: string;
  run_id?: string;
};

export type GitlabClaims = BaseClaims & {
  project_path: string;
  project_id: string;
  namespace_path?: string;
  /** `gitlab.com/group/project//.gitlab-ci.yml@refs/tags/v1.0.0` */
  ci_config_ref_uri?: string;
  environment?: string;
  ref?: string;
  ref_type?: string;
  sha?: string;
  pipeline_id?: string;
};

/** Identidad normalizada del job de CI que pide publicar. */
export type CiIdentity = {
  provider: 'github' | 'gitlab';
  /** `owner/repo` (GitHub) o `gitlab.com/<path>` (GitLab), igual que `api_tokens.repository`. */
  repository: string;
  /** Ruta tal como se guarda en `trusted_publishers.repository`. */
  path: string;
  repositoryId: string;
  /** `.github/workflows/release.yml` o `.gitlab-ci.yml`. */
  workflow: string | null;
  environment: string | null;
  ref: string | null;
  run: string | null;
};

type Jwk = JsonWebKey & { kid?: string };

const jwksCache = new Map<string, { at: number; keys: Jwk[] }>();

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
}

async function jwks(fetchImpl: typeof fetch, issuer: string): Promise<Jwk[]> {
  const hit = jwksCache.get(issuer);
  if (hit && Date.now() - hit.at < 3_600_000) return hit.keys;
  const res = await fetchImpl(JWKS_URL[issuer] ?? `${issuer}/.well-known/jwks`);
  if (!res.ok) throw new Error(`jwks ${res.status}`);
  const keys = ((await res.json()) as { keys: Jwk[] }).keys;
  jwksCache.set(issuer, { at: Date.now(), keys });
  return keys;
}

/** Solo tests: vacía la caché del JWKS. */
export function __resetJwks(): void {
  jwksCache.clear();
}

type VerifyOpts = { fetchImpl?: typeof fetch; now?: number; audience?: string };

/** Firma, emisor permitido, audiencia y fechas. Devuelve los claims crudos o `null`. */
async function verifyJwt(token: string, issuers: string[], opts: VerifyOpts): Promise<Record<string, unknown> | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts as [string, string, string];
  let header: { alg?: string; kid?: string };
  let claims: BaseClaims & Record<string, unknown>;
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlDecode(h)));
    claims = JSON.parse(new TextDecoder().decode(b64urlDecode(p)));
  } catch {
    return null;
  }
  if (header.alg !== 'RS256' || typeof claims.iss !== 'string' || !issuers.includes(claims.iss)) return null;
  // El emisor se elige de una lista cerrada antes de pedir su JWKS: nunca una URL tomada del token.
  const keys = await jwks(opts.fetchImpl ?? fetch, claims.iss).catch(() => [] as Jwk[]);
  const jwk = keys.find((k) => k.kid === header.kid) ?? (keys.length === 1 ? keys[0] : undefined);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const ok = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    b64urlDecode(s) as Uint8Array<ArrayBuffer>,
    new TextEncoder().encode(`${h}.${p}`),
  );
  if (!ok) return null;
  const now = Math.floor((opts.now ?? Date.now()) / 1000);
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(opts.audience ?? OIDC_AUDIENCE)) return null;
  if (typeof claims.exp !== 'number' || claims.exp < now - 30) return null;
  if (claims.nbf && claims.nbf > now + 30) return null;
  return claims;
}

/** Devuelve los claims si la firma, el emisor, la audiencia y las fechas son válidos; si no, `null`. */
export async function verifyGithubOidc(token: string, opts: VerifyOpts = {}): Promise<GithubClaims | null> {
  const claims = (await verifyJwt(token, [GITHUB_ISSUER], opts)) as GithubClaims | null;
  if (!claims?.repository || !claims.repository_id) return null;
  return claims;
}

/** `.github/workflows/release.yml` a partir de `job_workflow_ref` (o `workflow_ref`). */
export function workflowPath(claims: GithubClaims): string | null {
  const ref = claims.job_workflow_ref ?? claims.workflow_ref;
  const m = ref?.match(/^[^/]+\/[^/]+\/(.+?)@/);
  return m?.[1] ?? null;
}

/** `.gitlab-ci.yml` a partir de `ci_config_ref_uri` (`gitlab.com/<path>//<archivo>@<ref>`). */
export function gitlabConfigPath(claims: GitlabClaims): string | null {
  return claims.ci_config_ref_uri?.match(/\/\/(.+?)@/)?.[1] ?? null;
}

/** Token de GitHub Actions o de GitLab CI → identidad normalizada, o `null` si no es válido. */
export async function verifyCiOidc(token: string, opts: VerifyOpts = {}): Promise<CiIdentity | null> {
  const raw = await verifyJwt(token, [GITHUB_ISSUER, GITLAB_ISSUER], opts);
  if (!raw) return null;
  if (raw.iss === GITHUB_ISSUER) {
    const c = raw as GithubClaims;
    if (!c.repository || !c.repository_id) return null;
    return {
      provider: 'github',
      repository: c.repository,
      path: c.repository,
      repositoryId: String(c.repository_id),
      workflow: workflowPath(c),
      environment: c.environment ?? null,
      ref: c.ref ?? null,
      run: c.run_id ?? null,
    };
  }
  const c = raw as GitlabClaims;
  if (!c.project_path || !c.project_id) return null;
  return {
    provider: 'gitlab',
    repository: `gitlab.com/${c.project_path}`,
    path: c.project_path,
    repositoryId: String(c.project_id),
    workflow: gitlabConfigPath(c),
    environment: c.environment ?? null,
    ref: c.ref ?? null,
    run: c.pipeline_id ?? null,
  };
}
