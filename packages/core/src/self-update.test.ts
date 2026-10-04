import { createHash } from 'node:crypto';
import { chmod, mkdtemp, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assetName,
  BINARY_TARGETS,
  checkUpgrade,
  cleanupOldBinary,
  installMethod,
  latestVersion,
  parseChecksums,
  RELEASES_URL,
  upgradeBinary,
} from './self-update.js';
import { VERSION } from './version.js';

const NEW = new TextEncoder().encode('#!new genpm binary\n');
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

/** Fake de GitHub Releases: `latest` redirige a v9.9.9 y sirve SHA256SUMS + los binarios de esa versión. */
function releases(opts: { sums?: string; asset?: Uint8Array; latest?: string } = {}) {
  const requests: string[] = [];
  const fetchImpl = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    requests.push(url);
    if (url === `${RELEASES_URL}/latest`) {
      expect(init?.redirect).toBe('manual');
      return new Response(null, {
        status: 302,
        headers: { location: `https://github.com/genpm-net/genpm-releases/releases/tag/v${opts.latest ?? '9.9.9'}` },
      });
    }
    const m = url.match(/\/download\/v9\.9\.9\/(.+)$/);
    if (!m) return new Response('not found', { status: 404 });
    if (m[1] === 'SHA256SUMS')
      return new Response(opts.sums ?? BINARY_TARGETS.map((t) => `${sha(NEW)}  ${assetName(t)}`).join('\n'));
    return new Response(opts.asset ?? NEW);
  }) as typeof fetch;
  return { fetchImpl, requests };
}

async function fakeBinary() {
  const dir = await mkdtemp(join(tmpdir(), 'genpm-upgrade-'));
  const path = join(dir, 'genpm');
  await writeFile(path, 'old', { mode: 0o755 });
  return { dir, path };
}

describe('install method', () => {
  it('names one asset per target, .exe on Windows', () => {
    expect(assetName('darwin-arm64')).toBe('genpm-darwin-arm64');
    expect(assetName('linux-x64-musl')).toBe('genpm-linux-x64-musl');
    expect(assetName('windows-x64')).toBe('genpm-windows-x64.exe');
  });

  it('detects the standalone binary, npx and npm installs', () => {
    expect(installMethod({ target: 'linux-x64', execPath: '/home/a/.genpm/bin/genpm' })).toEqual({
      kind: 'binary',
      target: 'linux-x64',
      path: '/home/a/.genpm/bin/genpm',
    });
    expect(installMethod({ target: null, env: { npm_command: 'exec' } }).kind).toBe('npx');
    expect(installMethod({ target: null, env: {}, argv1: '/home/a/.npm/_npx/1a2b/node_modules/.bin/genpm' }).kind).toBe(
      'npx',
    );
    expect(installMethod({ target: null, env: {}, argv1: '/usr/local/lib/node_modules/genpm/dist/bin.mjs' })).toEqual({
      kind: 'npm',
      command: 'npm i -g genpm@latest',
    });
  });

  it('is not a binary when running on Node (tests, npm package)', () => {
    expect(installMethod().kind).not.toBe('binary');
  });
});

describe('checksums', () => {
  it('parses sha256sum output (text and binary mode) and ignores junk', () => {
    const a = 'a'.repeat(64);
    const b = 'B'.repeat(64);
    const sums = parseChecksums(`${a}  genpm-linux-x64\r\n${b} *genpm-windows-x64.exe\nnot a line\n`);
    expect(sums.get('genpm-linux-x64')).toBe(a);
    expect(sums.get('genpm-windows-x64.exe')).toBe('b'.repeat(64));
    expect(sums.size).toBe(2);
  });
});

describe('latest version', () => {
  it('reads the tag from the releases/latest redirect (no GitHub API quota)', async () => {
    expect(await latestVersion(releases().fetchImpl)).toBe('9.9.9');
    expect(await latestVersion(releases({ latest: '1.0.0-rc.1' }).fetchImpl)).toBe('1.0.0-rc.1');
  });

  it('fails with E_NETWORK when GitHub is unreachable or the redirect is unexpected', async () => {
    const down = (async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    await expect(latestVersion(down)).rejects.toMatchObject({ code: 'E_NETWORK' });
    const odd = (async () => new Response(null, { status: 302, headers: { location: '/login' } })) as typeof fetch;
    await expect(latestVersion(odd)).rejects.toMatchObject({ code: 'E_NETWORK' });
  });

  it('compares against the running version', async () => {
    const method = installMethod({ target: 'linux-x64', execPath: '/x/genpm' });
    expect(await checkUpgrade({ method, fetchImpl: releases().fetchImpl })).toMatchObject({
      current: VERSION,
      latest: '9.9.9',
      upToDate: false,
    });
    expect((await checkUpgrade({ method, fetchImpl: releases({ latest: '0.0.1' }).fetchImpl })).upToDate).toBe(true);
    expect((await checkUpgrade({ method, version: `v${VERSION}` })).upToDate).toBe(true);
    expect(await checkUpgrade({ method, version: '0.0.1' })).toMatchObject({ latest: '0.0.1', upToDate: false });
  });
});

describe('upgradeBinary', () => {
  it('downloads, verifies the SHA-256 and replaces the executable atomically', async () => {
    const { path, dir } = await fakeBinary();
    const { fetchImpl, requests } = releases();
    const res = await upgradeBinary({ version: '9.9.9', target: 'linux-x64', path, fetchImpl, platform: 'linux' });
    expect(res).toEqual({ asset: 'genpm-linux-x64', sha256: sha(NEW) });
    expect(await readFile(path, 'utf8')).toBe('#!new genpm binary\n');
    expect(requests).toEqual([
      `${RELEASES_URL}/download/v9.9.9/SHA256SUMS`,
      `${RELEASES_URL}/download/v9.9.9/genpm-linux-x64`,
    ]);
    expect(await readdir(dir)).toEqual(['genpm']);
    if (process.platform !== 'win32') expect((await stat(path)).mode & 0o777).toBe(0o755);
  });

  it('refuses a binary whose checksum does not match and leaves the old one untouched', async () => {
    const { path, dir } = await fakeBinary();
    const tampered = releases({ asset: new TextEncoder().encode('evil') });
    await expect(
      upgradeBinary({ version: '9.9.9', target: 'linux-x64', path, fetchImpl: tampered.fetchImpl }),
    ).rejects.toMatchObject({ code: 'E_UPGRADE_INTEGRITY' });
    expect(await readFile(path, 'utf8')).toBe('old');
    expect(await readdir(dir)).toEqual(['genpm']);
  });

  it('refuses an asset missing from SHA256SUMS', async () => {
    const { path } = await fakeBinary();
    const noSums = releases({ sums: `${sha(NEW)}  genpm-darwin-arm64\n` });
    await expect(
      upgradeBinary({ version: '9.9.9', target: 'linux-x64', path, fetchImpl: noSums.fetchImpl }),
    ).rejects.toMatchObject({ code: 'E_UPGRADE_INTEGRITY' });
    expect(await readFile(path, 'utf8')).toBe('old');
  });

  it('reports an unknown version as E_NO_MATCHING_VERSION', async () => {
    const { path } = await fakeBinary();
    await expect(
      upgradeBinary({ version: '1.2.3', target: 'linux-x64', path, fetchImpl: releases().fetchImpl }),
    ).rejects.toMatchObject({ code: 'E_NO_MATCHING_VERSION' });
  });

  it('on Windows renames the running .exe to .old and cleans it up on the next start', async () => {
    const { path, dir } = await fakeBinary();
    await upgradeBinary({
      version: '9.9.9',
      target: 'windows-x64',
      path,
      fetchImpl: releases().fetchImpl,
      platform: 'win32',
    });
    expect(await readFile(path, 'utf8')).toBe('#!new genpm binary\n');
    expect(await readFile(`${path}.old`, 'utf8')).toBe('old');
    await cleanupOldBinary({ kind: 'binary', target: 'windows-x64', path });
    expect(await readdir(dir)).toEqual(['genpm']);
  });

  it.skipIf(process.platform === 'win32' || process.getuid?.() === 0)(
    'maps a read-only install directory to E_UPGRADE_PERMISSION',
    async () => {
      const { path, dir } = await fakeBinary();
      await chmod(dir, 0o555);
      try {
        await expect(
          upgradeBinary({ version: '9.9.9', target: 'linux-x64', path, fetchImpl: releases().fetchImpl }),
        ).rejects.toMatchObject({ code: 'E_UPGRADE_PERMISSION', details: { params: { path } } });
        expect(await readFile(path, 'utf8')).toBe('old');
      } finally {
        await chmod(dir, 0o755);
      }
    },
  );
});
