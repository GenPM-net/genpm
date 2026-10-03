import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadRc, mergeRc, parseRc, registryFor } from './config.js';
import { detect, detectClients, detectPackageManager, findRoot, isEmptyDir, readPackageDeps } from './detect.js';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'genpm-detect-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('findRoot', () => {
  it('prefers genpm.lock over .git over package.json', async () => {
    await mkdir(join(dir, 'app/packages/web/src'), { recursive: true });
    await writeFile(join(dir, 'app/package.json'), '{}');
    await writeFile(join(dir, 'app/packages/web/package.json'), '{}');
    expect(await findRoot(join(dir, 'app/packages/web/src'), dir)).toBe(join(dir, 'app/packages/web'));
    await mkdir(join(dir, 'app/.git'));
    expect(await findRoot(join(dir, 'app/packages/web/src'), dir)).toBe(join(dir, 'app'));
    await writeFile(join(dir, 'app/packages/genpm.lock'), '');
    expect(await findRoot(join(dir, 'app/packages/web/src'), dir)).toBe(join(dir, 'app/packages'));
  });
  it('fails with E_NOT_A_PROJECT and stops at home', async () => {
    await mkdir(join(dir, 'empty'));
    await expect(findRoot(join(dir, 'empty'), dir)).rejects.toMatchObject({ code: 'E_NOT_A_PROJECT' });
  });
});

describe('detectClients', () => {
  it('always includes agents and detects signals', async () => {
    expect(await detectClients(dir)).toEqual(['agents']);
    await writeFile(join(dir, 'CLAUDE.md'), '');
    await mkdir(join(dir, '.cursor'));
    await mkdir(join(dir, '.github'));
    await writeFile(join(dir, '.github/copilot-instructions.md'), '');
    await writeFile(join(dir, '.windsurfrules'), '');
    expect(await detectClients(dir)).toEqual(['agents', 'claude', 'cursor', 'copilot', 'windsurf']);
  });
  it('honours overrides and ignores unknown names', async () => {
    expect(await detectClients(dir, ['cursor', 'nope', 'agents'])).toEqual(['agents', 'cursor']);
  });
});

describe('detectPackageManager', () => {
  it('detects from lockfiles, packageManager field or defaults to npm', async () => {
    expect(await detectPackageManager(dir)).toBeNull();
    await writeFile(join(dir, 'package.json'), '{"packageManager":"yarn@4.0.0"}');
    expect(await detectPackageManager(dir)).toBe('yarn');
    await writeFile(join(dir, 'package.json'), '{oops');
    expect(await detectPackageManager(dir)).toBe('npm');
    await writeFile(join(dir, 'package.json'), '{}');
    expect(await detectPackageManager(dir)).toBe('npm');
    await writeFile(join(dir, 'bun.lockb'), '');
    expect(await detectPackageManager(dir)).toBe('bun');
    await writeFile(join(dir, 'pnpm-lock.yaml'), '');
    expect(await detectPackageManager(dir)).toBe('pnpm');
  });
  it('reads declared deps', async () => {
    expect(await readPackageDeps(dir)).toEqual({});
    await writeFile(join(dir, 'package.json'), '{"dependencies":{"a":"^1"},"devDependencies":{"b":"^2"}}');
    expect(await readPackageDeps(dir)).toEqual({ a: '^1', b: '^2' });
    await writeFile(join(dir, 'package.json'), 'nope');
    expect(await readPackageDeps(dir)).toEqual({});
  });
});

describe('detect', () => {
  it('combines root, clients and package manager', async () => {
    await writeFile(join(dir, 'package.json'), '{}');
    await writeFile(join(dir, 'package-lock.json'), '{}');
    await mkdir(join(dir, '.claude'));
    expect(await detect(dir, { home: dir })).toEqual({
      root: dir,
      clients: ['agents', 'claude'],
      packageManager: 'npm',
    });
  });
  it('checks empty dirs', async () => {
    expect(await isEmptyDir(join(dir, 'nope'))).toBe(true);
    expect(await isEmptyDir(dir)).toBe(true);
    await writeFile(join(dir, 'x'), '');
    expect(await isEmptyDir(dir)).toBe(false);
    await expect(isEmptyDir(join(dir, 'x'))).rejects.toThrow();
  });
});

describe('.genpmrc', () => {
  it('parses INI with scoped registries', () => {
    const rc = parseRc(
      '# c\nregistry=https://r.example\n@acme:registry=https://acme.genpm.net\nclients=cursor, claude\nlang=es\nnoise\n; x',
    );
    expect(rc).toEqual({
      registry: 'https://r.example',
      scopes: { acme: 'https://acme.genpm.net' },
      clients: ['cursor', 'claude'],
      lang: 'es',
    });
  });
  it('merges layers and routes by scope', async () => {
    const rc = mergeRc(
      parseRc('registry=https://user\nlang=en'),
      parseRc('@acme:registry=https://acme/\nclients=agents'),
    );
    expect(registryFor('@acme/x', rc)).toBe('https://acme');
    expect(registryFor('@core/x', rc)).toBe('https://user');
    expect(registryFor('@core/x', rc, 'http://localhost:8787/')).toBe('http://localhost:8787');
    expect(registryFor(null, { scopes: {} })).toBe('https://api.genpm.net');
    await writeFile(join(dir, '.genpmrc'), 'lang=pt-BR');
    expect((await loadRc(dir, join(dir, 'nohome'))).lang).toBe('pt-BR');
    expect(await loadRc(null, join(dir, 'nohome'))).toEqual({ scopes: {} });
  });
});
