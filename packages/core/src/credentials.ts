// Credenciales del CLI (security §4.2): `GENPM_TOKEN` (CI) > `~/.genpm/auth.json` (0600, indexado por registry).
// El CLI se niega a usar el archivo si otros usuarios pueden leerlo (E_INSECURE_PERMS). El MCP nunca accede aquí.

import { chmod, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fail } from './errors.js';

export type StoredToken = { token: string; expiresAt: string | null; handle: string };
type AuthFile = { registries: Record<string, StoredToken> };

export function authFilePath(home = homedir()): string {
  return join(home, '.genpm', 'auth.json');
}

async function readAuthFile(home?: string): Promise<AuthFile> {
  const path = authFilePath(home);
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch {
    return { registries: {} };
  }
  if (process.platform !== 'win32') {
    const mode = (await stat(path)).mode & 0o777;
    if (mode & 0o077) throw fail('E_INSECURE_PERMS', { path });
  }
  try {
    const j = JSON.parse(text) as AuthFile;
    return { registries: j.registries ?? {} };
  } catch {
    return { registries: {} };
  }
}

export async function getToken(
  registry: string,
  opts: { env?: Record<string, string | undefined>; home?: string } = {},
): Promise<string | null> {
  const env = opts.env ?? process.env;
  if (env['GENPM_TOKEN']) return env['GENPM_TOKEN'];
  const file = await readAuthFile(opts.home);
  const entry = file.registries[registry];
  if (!entry) return null;
  if (entry.expiresAt && Date.parse(entry.expiresAt) < Date.now()) return null;
  return entry.token;
}

export async function getStored(registry: string, home?: string): Promise<StoredToken | null> {
  return (await readAuthFile(home)).registries[registry] ?? null;
}

export async function saveToken(registry: string, value: StoredToken, home?: string): Promise<string> {
  const path = authFilePath(home);
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const file = await readAuthFile(home).catch(() => ({ registries: {} }) as AuthFile);
  file.registries[registry] = value;
  await writeFile(path, `${JSON.stringify(file, null, 2)}\n`, { mode: 0o600 });
  await chmod(path, 0o600);
  return path;
}

export async function removeToken(registry: string, home?: string): Promise<boolean> {
  const path = authFilePath(home);
  const file = await readAuthFile(home);
  if (!file.registries[registry]) return false;
  delete file.registries[registry];
  await writeFile(path, `${JSON.stringify(file, null, 2)}\n`, { mode: 0o600 });
  return true;
}

// ───────────── GitHub OAuth Device Flow (architecture §6.5) ─────────────

/** client_id público de la OAuth App de GenPM (D0-06). Se puede sobrescribir con GENPM_GITHUB_CLIENT_ID. */
export const GITHUB_CLIENT_ID = 'Ov23liSiKhBNcDHqJrvI';

export type DeviceCode = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
};

export async function startDeviceFlow(clientId: string, fetchImpl: typeof fetch = fetch): Promise<DeviceCode> {
  if (!clientId) throw fail('E_AUTH');
  const res = await fetchImpl('https://github.com/login/device/code', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, scope: 'read:user read:org' }),
  }).catch(() => {
    throw fail('E_NETWORK', { host: 'github.com' });
  });
  if (!res.ok) throw fail('E_UPSTREAM_GIT', { detail: `device code ${res.status}` });
  return (await res.json()) as DeviceCode;
}

export async function pollDeviceFlow(
  clientId: string,
  code: DeviceCode,
  opts: { fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void>; now?: () => number } = {},
): Promise<string> {
  const doFetch = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const now = opts.now ?? Date.now;
  const deadline = now() + code.expires_in * 1000;
  let interval = code.interval * 1000;
  while (now() < deadline) {
    await sleep(interval);
    const res = await doFetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        device_code: code.device_code,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });
    const body = (await res.json()) as { access_token?: string; error?: string; interval?: number };
    if (body.access_token) return body.access_token;
    if (body.error === 'authorization_pending') continue;
    if (body.error === 'slow_down') {
      interval = (body.interval ?? code.interval + 5) * 1000;
      continue;
    }
    throw fail('E_AUTH');
  }
  throw fail('E_AUTH');
}

/**
 * Trusted publishing (V03-01): dentro de GitHub Actions con `permissions: id-token: write`, pide a Actions un token
 * OIDC con audiencia `genpm` y lo canjea en el registry por un token `publish` de 15 minutos. En GitLab CI (V03-03) el
 * job declara `id_tokens: GENPM_ID_TOKEN: { aud: genpm }` y el token llega ya hecho en esa variable. Sin esas
 * variables, o si el registry no tiene autorizado el repositorio, devuelve `null` (el CLI pide `GENPM_TOKEN` o login).
 */
export async function oidcToken(
  registry: string,
  opts: { env?: Record<string, string | undefined>; fetchImpl?: typeof fetch } = {},
): Promise<string | null> {
  const env = opts.env ?? process.env;
  if (env['GENPM_OIDC'] === '0') return null;
  const url = env['ACTIONS_ID_TOKEN_REQUEST_URL'];
  const bearer = env['ACTIONS_ID_TOKEN_REQUEST_TOKEN'];
  const ready = env['GENPM_ID_TOKEN'];
  if (!ready && (!url || !bearer)) return null;
  const f = opts.fetchImpl ?? fetch;
  try {
    let value = ready;
    if (!value) {
      const res = await f(`${url}${url!.includes('?') ? '&' : '?'}audience=genpm`, {
        headers: { authorization: `bearer ${bearer}`, accept: 'application/json' },
      });
      if (!res.ok) return null;
      value = ((await res.json()) as { value?: string }).value;
    }
    if (!value) return null;
    const ex = await f(`${registry.replace(/\/$/, '')}/v1/auth/oidc/exchange`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ token: value }),
    });
    if (!ex.ok) return null;
    return ((await ex.json()) as { token?: string }).token ?? null;
  } catch {
    return null;
  }
}
