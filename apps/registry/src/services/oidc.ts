// Verificación de tokens OIDC de GitHub Actions (V03-01). RS256 contra el JWKS público de GitHub, con `iss`, `aud`
// y `exp` comprobados. Sin dependencias: WebCrypto del runtime.

export const GITHUB_ISSUER = 'https://token.actions.githubusercontent.com';
/** Audiencia que el CLI pide a Actions (`core.getIDToken('genpm')`). */
export const OIDC_AUDIENCE = 'genpm';

export type GithubClaims = {
  iss: string;
  aud: string | string[];
  exp: number;
  nbf?: number;
  iat?: number;
  sub: string;
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

type Jwk = JsonWebKey & { kid?: string };

let jwksCache: { at: number; keys: Jwk[] } | null = null;

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
}

async function jwks(fetchImpl: typeof fetch, issuer: string): Promise<Jwk[]> {
  if (jwksCache && Date.now() - jwksCache.at < 3_600_000) return jwksCache.keys;
  const res = await fetchImpl(`${issuer}/.well-known/jwks`);
  if (!res.ok) throw new Error(`jwks ${res.status}`);
  const keys = ((await res.json()) as { keys: Jwk[] }).keys;
  jwksCache = { at: Date.now(), keys };
  return keys;
}

/** Solo tests: vacía la caché del JWKS. */
export function __resetJwks(): void {
  jwksCache = null;
}

/** Devuelve los claims si la firma, el emisor, la audiencia y las fechas son válidos; si no, `null`. */
export async function verifyGithubOidc(
  token: string,
  opts: { fetchImpl?: typeof fetch; now?: number; issuer?: string; audience?: string } = {},
): Promise<GithubClaims | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts as [string, string, string];
  let header: { alg?: string; kid?: string };
  let claims: GithubClaims;
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlDecode(h)));
    claims = JSON.parse(new TextDecoder().decode(b64urlDecode(p)));
  } catch {
    return null;
  }
  if (header.alg !== 'RS256') return null;
  const issuer = opts.issuer ?? GITHUB_ISSUER;
  const keys = await jwks(opts.fetchImpl ?? fetch, issuer).catch(() => [] as Jwk[]);
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
  if (claims.iss !== issuer || !aud.includes(opts.audience ?? OIDC_AUDIENCE)) return null;
  if (typeof claims.exp !== 'number' || claims.exp < now - 30) return null;
  if (claims.nbf && claims.nbf > now + 30) return null;
  if (!claims.repository || !claims.repository_id) return null;
  return claims;
}

/** `.github/workflows/release.yml` a partir de `job_workflow_ref` (o `workflow_ref`). */
export function workflowPath(claims: GithubClaims): string | null {
  const ref = claims.job_workflow_ref ?? claims.workflow_ref;
  const m = ref?.match(/^[^/]+\/[^/]+\/(.+?)@/);
  return m?.[1] ?? null;
}
