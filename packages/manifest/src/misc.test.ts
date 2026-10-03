import { describe, expect, it } from 'vitest';
import { base64UrlToBytes, bytesToBase64Url, sha256Hex, toHex } from './canonical.js';
import { ERROR_CODES, errorType, exitCode, GenpmError, httpStatus, isErrorCode, isGenpmError } from './errors.js';
import { emptyLock, parseLock, serializeLock } from './lockfile.js';
import {
  compareVersions,
  diffKind,
  isPrerelease,
  isValidRange,
  maxSatisfying,
  parseVersionParts,
  satisfies,
} from './manifest.js';
import { parseSpec } from './spec.js';

const msgs = { message: 'invalid lock', fix: 'restore it from git' };
const entry = (v: string) => ({
  v,
  r: 'https://github.com/genpm-net/db',
  t: `v${v}`,
  c: 'a'.repeat(40),
  d: 'src/lib/db',
  x: 'AGENTS.md',
  h: 'sha256-Zm9v',
  sg: 'k1:abc',
  m: 0 as const,
  by: 'cli' as const,
});

describe('lockfile', () => {
  it('serializes one package per line, sorted', () => {
    const lock = emptyLock();
    lock.p['@core/db'] = entry('1.0.3');
    lock.p['@core/auth'] = { ...entry('1.2.0'), g: { '@core/z': '^1', '@core/db': '^1.0.0' }, by: 'mcp' };
    const text = serializeLock(lock);
    const lines = text.split('\n');
    expect(lines[0]).toBe('{"$":1,');
    expect(lines[1]).toBe('"p":{');
    expect(lines[2]).toMatch(/^"@core\/auth":\{"v":"1.2.0".*"g":\{"@core\/db":"\^1.0.0","@core\/z":"\^1"\}\},$/);
    expect(lines[3]).toMatch(/^"@core\/db":\{"v":"1.0.3",.*\}$/);
    expect(lines[4]).toBe('}}');
    expect(parseLock(text, msgs)).toEqual(lock);
  });
  it('serializes an empty lock', () => {
    expect(serializeLock(emptyLock())).toBe('{"$":1,\n"p":{\n}}\n');
    expect(parseLock(serializeLock(emptyLock()), msgs)).toEqual(emptyLock());
  });
  it('rejects invalid JSON and invalid entries', () => {
    expect(() => parseLock('{', msgs)).toThrowError(GenpmError);
    try {
      parseLock('{"$":1,"p":{"@core/db":{"v":"x"}}}', msgs);
    } catch (e) {
      expect(isGenpmError(e)).toBe(true);
      expect((e as GenpmError).code).toBe('E_LOCK_INVALID');
      expect((e as GenpmError).details?.['issues']).toBeInstanceOf(Array);
    }
  });
});

describe('errors', () => {
  it('maps codes to http and exit codes', () => {
    expect(httpStatus('E_RANGE_UNSATISFIED')).toBe(409);
    expect(exitCode('E_DRIFT')).toBe(4);
    expect(exitCode('E_SIGNATURE')).toBe(6);
    expect(errorType('E_AUTH')).toBe('https://genpm.net/errors/E_AUTH');
    expect(isErrorCode('E_AUTH')).toBe(true);
    expect(isErrorCode('nope')).toBe(false);
    expect(ERROR_CODES.every((c) => /^E_[A-Z_]+$/.test(c))).toBe(true);
  });
  it('serializes to {code,message,fix,details}', () => {
    const e = new GenpmError('E_DRIFT', 'm', 'f');
    expect(e.exitCode).toBe(4);
    expect(JSON.stringify(e)).toBe('{"code":"E_DRIFT","message":"m","fix":"f"}');
    expect(new GenpmError('E_DRIFT', 'm', 'f', { a: 1 }).toJSON()).toEqual({
      code: 'E_DRIFT',
      message: 'm',
      fix: 'f',
      details: { a: 1 },
    });
    expect(isGenpmError({ code: 'E_AUTH' })).toBe(true);
    expect(isGenpmError(new Error('x'))).toBe(false);
    expect(isGenpmError(null)).toBe(false);
  });
});

describe('semver helpers', () => {
  it('resolves ranges without prereleases unless asked', () => {
    const vs = ['1.0.0', '1.2.0', '1.3.0-beta.1', '2.0.0'];
    expect(maxSatisfying(vs, '^1')).toBe('1.2.0');
    expect(maxSatisfying(vs, '^1.3.0-beta.0')).toBe('1.3.0-beta.1');
    expect(maxSatisfying(vs, '^3')).toBeNull();
    expect(satisfies('1.2.0', '^1.0.0')).toBe(true);
    expect(isValidRange('>=1 <2')).toBe(true);
    expect(isValidRange('nope')).toBe(false);
    expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
    expect(isPrerelease('1.0.0-rc.1')).toBe(true);
  });
  it('classifies upgrades', () => {
    expect(diffKind('1.0.0', '2.0.0')).toBe('major');
    expect(diffKind('1.0.0', '1.1.0')).toBe('minor');
    expect(diffKind('1.0.0', '1.0.1')).toBe('patch');
    expect(diffKind('1.0.0-a', '1.0.0-b')).toBe('prerelease');
    expect(diffKind('1.0.0', '1.0.0')).toBeNull();
    expect(diffKind('1.0.0', '2.0.0-rc.1')).toBe('major');
    expect(diffKind('1.0.0', '1.1.0-rc.1')).toBe('minor');
    expect(diffKind('1.0.0', '1.0.1-rc.1')).toBe('patch');
  });
  it('splits version parts', () => {
    expect(parseVersionParts('2.0.0-beta.1')).toEqual({ major: 2, minor: 0, patch: 0, prerelease: 'beta.1' });
    expect(parseVersionParts('1.2.3').prerelease).toBeNull();
    expect(() => parseVersionParts('x')).toThrow();
  });
});

describe('spec grammar', () => {
  it('parses registry specs', () => {
    expect(parseSpec('@core/auth')).toEqual({
      ok: true,
      spec: { kind: 'registry', name: '@core/auth', range: 'latest' },
    });
    expect(parseSpec('@core/auth@^1.2')).toEqual({
      ok: true,
      spec: { kind: 'registry', name: '@core/auth', range: '^1.2' },
    });
    expect(parseSpec('@core/auth@>=1 <2')).toMatchObject({ ok: true });
    expect(parseSpec('@core/auth@next')).toMatchObject({ ok: true, spec: { range: 'next' } });
    expect(parseSpec('@core/auth@1.2.0')).toMatchObject({ ok: true, spec: { range: '1.2.0' } });
    expect(parseSpec('@core/auth@')).toEqual({ ok: false, problem: 'invalid_range' });
    expect(parseSpec('@core/auth@!!')).toEqual({ ok: false, problem: 'invalid_range' });
    expect(parseSpec('@Core/auth')).toEqual({ ok: false, problem: 'invalid_name' });
    expect(parseSpec('auth')).toEqual({ ok: false, problem: 'invalid_name' });
  });
  it('parses direct specs and requires a ref', () => {
    expect(parseSpec('gh:genpm-net/auth#v1.0.0')).toMatchObject({
      ok: true,
      spec: { kind: 'github', owner: 'genpm-net', repo: 'auth', ref: 'v1.0.0' },
    });
    expect(parseSpec('gh:genpm-net/auth')).toEqual({ ok: false, problem: 'missing_ref' });
    expect(parseSpec('gh:genpm-net/auth#main')).toEqual({ ok: false, problem: 'invalid_ref' });
    expect(parseSpec('gh:bad')).toEqual({ ok: false, problem: 'invalid_spec' });
    expect(parseSpec('file:../pkg')).toMatchObject({ ok: true, spec: { kind: 'file', path: '../pkg' } });
    expect(parseSpec('file:')).toEqual({ ok: false, problem: 'invalid_spec' });
  });
});

describe('encoding', () => {
  it('round-trips base64url and hashes', async () => {
    const bytes = new Uint8Array([0, 255, 62, 63, 1]);
    expect(base64UrlToBytes(bytesToBase64Url(bytes))).toEqual(bytes);
    expect(toHex(new Uint8Array([1, 171]).buffer)).toBe('01ab');
    expect(await sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(await sha256Hex(new Uint8Array())).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});
