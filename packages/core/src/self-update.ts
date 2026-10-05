// Binario nativo de genpm y `genpm upgrade` (ADR-025). release.yml compila el CLI con `bun build --compile` para cada
// plataforma y lo publica en GitHub Releases junto a SHA256SUMS. Solo el binario se auto-actualiza; las copias de
// npm/npx se actualizan con su gestor. El único archivo que se escribe es el propio ejecutable, en su directorio:
// nunca se toca el proyecto (INV-3 no aplica) y no se ejecuta nada descargado (INV-2).

import { createHash } from 'node:crypto';
import { rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { compareVersions } from '@genpm/manifest';
import { fail } from './errors.js';
import { VERSION } from './version.js';

/** Lo inyecta `bun build --define` en scripts/build-binaries.mjs; no existe en el paquete de npm. */
declare const __GENPM_BINARY_TARGET__: string | undefined;

// Repo público solo con los binarios mientras el código sea privado (ADR-016); tras abrirlo se puede volver a genpm-net/genpm.
export const RELEASES_URL = 'https://github.com/genpm-net/genpm-releases/releases';

export const BINARY_TARGETS = [
  'darwin-arm64',
  'darwin-x64',
  'linux-x64',
  'linux-arm64',
  'linux-x64-musl',
  'linux-arm64-musl',
  'windows-x64',
  'windows-arm64',
] as const;
export type BinaryTarget = (typeof BINARY_TARGETS)[number];

/** Plataforma para la que se compiló este binario, o `null` si genpm corre sobre Node (npm/npx). */
export function binaryTarget(): BinaryTarget | null {
  return typeof __GENPM_BINARY_TARGET__ === 'string' ? (__GENPM_BINARY_TARGET__ as BinaryTarget) : null;
}

/** `genpm-darwin-arm64`, `genpm-windows-x64.exe`… (mismo nombre en el release, install.sh e install.ps1). */
export function assetName(target: BinaryTarget): string {
  return `genpm-${target}${target.startsWith('windows') ? '.exe' : ''}`;
}

export type InstallMethod =
  /** `manager`: el binario lo gestiona Homebrew o Scoop; se actualiza con su comando, no con `genpm upgrade`. */
  | { kind: 'binary'; target: BinaryTarget; path: string; manager?: { via: 'Homebrew' | 'Scoop'; command: string } }
  | { kind: 'npx'; command: string }
  | { kind: 'npm'; command: string };

/** Homebrew (`…/Cellar/genpm/…`) o Scoop (`…\\scoop\\apps\\genpm\\…`) según la ruta del binario. */
export function binaryManager(path: string): { manager?: { via: 'Homebrew' | 'Scoop'; command: string } } {
  if (/[\\/]Cellar[\\/]genpm[\\/]/.test(path)) return { manager: { via: 'Homebrew', command: 'brew upgrade genpm' } };
  if (/[\\/]scoop[\\/]apps[\\/]genpm[\\/]/i.test(path))
    return { manager: { via: 'Scoop', command: 'scoop update genpm' } };
  return {};
}

export function installMethod(
  opts: { target?: BinaryTarget | null; execPath?: string; argv1?: string; env?: NodeJS.ProcessEnv } = {},
): InstallMethod {
  const target = opts.target === undefined ? binaryTarget() : opts.target;
  if (target) {
    const path = opts.execPath ?? process.execPath;
    return { kind: 'binary', target, path, ...binaryManager(path) };
  }
  const env = opts.env ?? process.env;
  const script = opts.argv1 ?? process.argv[1] ?? '';
  // npx/`npm exec` marcan npm_command=exec; pnpm dlx y npx ejecutan desde una caché temporal.
  if (env['npm_command'] === 'exec' || /[\\/](_npx|dlx-[^\\/]*)[\\/]/.test(script))
    return { kind: 'npx', command: 'npx @genpm-net/cli@latest' };
  return { kind: 'npm', command: 'npm i -g @genpm-net/cli@latest' };
}

/** Formato de `sha256sum`: `<hex>  <archivo>` (o `<hex> *<archivo>` en modo binario). */
export function parseChecksums(text: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const m = line.trim().match(/^([0-9a-f]{64}) [ *]?(\S+)$/i);
    if (m) out.set(m[2]!, m[1]!.toLowerCase());
  }
  return out;
}

const HOST = 'github.com';
const headers = { 'user-agent': `genpm/${VERSION} (upgrade; ${process.platform})` };

/** GET a github.com. Un 404 de un release concreto significa que esa versión no existe. */
async function get(url: string, fetchImpl: typeof fetch, opts: { manual?: boolean; version?: string } = {}) {
  let res: Response;
  try {
    res = await fetchImpl(url, { headers, redirect: opts.manual ? 'manual' : 'follow' });
  } catch {
    throw fail('E_NETWORK', { host: HOST });
  }
  if (res.status === 404 && opts.version) throw fail('E_NO_MATCHING_VERSION', { name: 'genpm', range: opts.version });
  if (res.status >= 400) throw fail('E_NETWORK', { host: HOST });
  return res;
}

/**
 * Última versión publicada. `releases/latest` redirige a `releases/tag/vX.Y.Z`: leer esa cabecera no gasta cuota de
 * la API de GitHub (60 peticiones/hora sin token).
 */
export async function latestVersion(fetchImpl: typeof fetch = fetch): Promise<string> {
  const res = await get(`${RELEASES_URL}/latest`, fetchImpl, { manual: true });
  const m = (res.headers.get('location') ?? '').match(/\/releases\/tag\/v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/);
  if (!m) throw fail('E_NETWORK', { host: HOST });
  return m[1]!;
}

export type UpgradeCheck = { current: string; latest: string; upToDate: boolean; method: InstallMethod };

export async function checkUpgrade(
  opts: { method?: InstallMethod; version?: string; fetchImpl?: typeof fetch } = {},
): Promise<UpgradeCheck> {
  const method = opts.method ?? installMethod();
  const latest = opts.version?.replace(/^v/, '') ?? (await latestVersion(opts.fetchImpl));
  // Con versión explícita se permite volver atrás; sin ella, solo avanzar.
  const upToDate = opts.version ? latest === VERSION : compareVersions(latest, VERSION) <= 0;
  return { current: VERSION, latest, upToDate, method };
}

/**
 * Descarga el binario de `version` para `target`, verifica su SHA-256 contra SHA256SUMS del mismo release y reemplaza
 * `path` de forma atómica (`rename` en el mismo directorio). En Windows un .exe en uso no se puede sobrescribir pero sí
 * renombrar: el anterior queda como `<path>.old` y se borra en el siguiente arranque (`cleanupOldBinary`).
 */
export async function upgradeBinary(opts: {
  version: string;
  target: BinaryTarget;
  path: string;
  fetchImpl?: typeof fetch;
  platform?: NodeJS.Platform;
}): Promise<{ asset: string; sha256: string }> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const asset = assetName(opts.target);
  const base = `${RELEASES_URL}/download/v${opts.version}`;
  const sums = parseChecksums(await (await get(`${base}/SHA256SUMS`, fetchImpl, { version: opts.version })).text());
  const expected = sums.get(asset);
  if (!expected) throw fail('E_UPGRADE_INTEGRITY', { asset });
  const bytes = new Uint8Array(
    await (await get(`${base}/${asset}`, fetchImpl, { version: opts.version })).arrayBuffer(),
  );
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (sha256 !== expected) throw fail('E_UPGRADE_INTEGRITY', { asset });

  const tmp = join(dirname(opts.path), `.${basename(opts.path)}.${process.pid}.new`);
  try {
    await writeFile(tmp, bytes, { mode: 0o755 });
    if ((opts.platform ?? process.platform) === 'win32') {
      const old = `${opts.path}.old`;
      await rm(old, { force: true });
      await rename(opts.path, old);
      try {
        await rename(tmp, opts.path);
      } catch (e) {
        await rename(old, opts.path);
        throw e;
      }
    } else {
      await rename(tmp, opts.path);
    }
  } catch (e) {
    await rm(tmp, { force: true }).catch(() => {});
    const code = (e as NodeJS.ErrnoException).code;
    if (code === 'EACCES' || code === 'EPERM') throw fail('E_UPGRADE_PERMISSION', { path: opts.path });
    throw e;
  }
  return { asset, sha256 };
}

/** Borra el `.exe.old` que deja `upgradeBinary` en Windows. Sin efecto fuera del binario de Windows. */
export async function cleanupOldBinary(method: InstallMethod = installMethod()): Promise<void> {
  if (method.kind !== 'binary' || !method.target.startsWith('windows')) return;
  await rm(`${method.path}.old`, { force: true }).catch(() => {});
}
