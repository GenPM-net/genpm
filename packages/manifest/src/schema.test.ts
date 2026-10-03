import { describe, expect, it } from 'vitest';
import golden from '../fixtures/golden.json' with { type: 'json' };
import { canonicalize, manifestHash } from './canonical.js';
import {
  mcpNameFromPackage,
  normalizeMcp,
  pickSummary,
  toResolved,
  validateResolved,
  validateSource,
} from './manifest.js';
import { LockEntry } from './schema.js';

describe('golden fixtures · source manifest', () => {
  for (const c of golden.source.valid) {
    it(`accepts ${c.name}`, () => {
      const r = validateSource(c.input);
      expect(r.issues).toEqual([]);
      expect(r.ok).toBe(true);
    });
  }
  for (const c of golden.source.invalid) {
    it(`rejects ${c.name} with ${c.code}`, () => {
      const r = validateSource(c.input);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.code).toBe(c.code);
        expect(r.issues.length).toBeGreaterThan(0);
        for (const i of r.issues) expect(typeof i.path).toBe('string');
      }
    });
  }
});

describe('golden fixtures · resolved manifest', () => {
  for (const c of golden.resolved.valid) {
    it(`accepts and canonicalizes ${c.name}`, async () => {
      const r = validateResolved(c.input);
      expect(r.ok).toBe(true);
      expect(canonicalize(c.input)).toBe(c.canonical);
      expect(await manifestHash(c.input)).toMatch(/^[0-9a-f]{64}$/);
    });
  }
  for (const c of golden.resolved.invalid) {
    it(`rejects ${c.name}`, () => {
      const r = validateResolved(c.input);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe(c.code);
    });
  }
});

describe('canonical form', () => {
  it('orders keys, sorts maps and mcp entries, puts _* last and drops sg', () => {
    const out = canonicalize({
      _z: 1,
      m: [{ e: ['A_B'], a: ['-y'], c: 'npx', n: 'x' }, 'pkg'],
      sg: 'k1:abc',
      p: { b: '1', a: '2' },
      n: '@a/b',
      $: 1,
      _a: 2,
      s: { es: 'b', en: 'a' },
    });
    expect(out).toBe(
      '{"$":1,"n":"@a/b","s":{"en":"a","es":"b"},"p":{"a":"2","b":"1"},"m":[{"n":"x","c":"npx","a":["-y"],"e":["A_B"]},"pkg"],"_a":2,"_z":1}',
    );
  });
  it('is stable regardless of input key order', async () => {
    const a = { n: '@a/b', v: '1.0.0', d: 'src/x' };
    const b = { d: 'src/x', v: '1.0.0', n: '@a/b' };
    expect(await manifestHash(a)).toBe(await manifestHash(b));
  });
});

describe('toResolved', () => {
  it('fills defaults and coordinates', () => {
    const src = validateSource({ n: '@core/email', v: '1.0.0', d: 'src/lib/email' });
    if (!src.ok) throw new Error('fixture');
    const r = toResolved(src.data, {
      r: 'https://github.com/genpm-net/email',
      t: 'v1.0.0',
      c: 'a'.repeat(40),
      l: 'MIT',
    });
    expect(canonicalize(r)).toBe(
      `{"$":1,"n":"@core/email","v":"1.0.0","r":"https://github.com/genpm-net/email","t":"v1.0.0","c":"${'a'.repeat(40)}","d":"src/lib/email","i":".","x":"AGENTS.md","l":"MIT"}`,
    );
  });
});

describe('mcp shorthand', () => {
  it('derives server names', () => {
    expect(mcpNameFromPackage('@stripe/mcp')).toBe('stripe-mcp');
    expect(mcpNameFromPackage('@modelcontextprotocol/server-github')).toBe('server-github-mcp');
    expect(mcpNameFromPackage('context7-mcp')).toBe('context7-mcp');
    expect(mcpNameFromPackage('@upstash/context7.mcp')).toBe('context7-mcp');
    expect(mcpNameFromPackage('@a/mcp-server')).toBe('a-mcp');
    expect(mcpNameFromPackage('---')).toBe('mcp');
  });
  it('expands to npx', () => {
    expect(normalizeMcp('@stripe/mcp')).toEqual({ n: 'stripe-mcp', c: 'npx', a: ['-y', '@stripe/mcp'] });
    expect(normalizeMcp({ n: 'x', u: 'https://x.dev' })).toEqual({ n: 'x', u: 'https://x.dev' });
  });
});

describe('summary', () => {
  it('picks the requested locale, its base or en', () => {
    const s = { en: 'a', es: 'b', 'pt-BR': 'c' };
    expect(pickSummary(s, 'es')).toBe('b');
    expect(pickSummary(s, 'es-MX')).toBe('b');
    expect(pickSummary(s, 'pt-BR')).toBe('c');
    expect(pickSummary(s, 'ja')).toBe('a');
    expect(pickSummary('x', 'ja')).toBe('x');
    expect(pickSummary(undefined)).toBeUndefined();
  });
});

describe('lock entry', () => {
  it('validates integrity hash format', () => {
    const base = {
      v: '1.0.0',
      r: 'https://github.com/a/b',
      t: 'v1.0.0',
      c: 'a'.repeat(40),
      d: 'src/x',
      x: 'AGENTS.md',
      m: 0,
      by: 'cli',
    };
    expect(LockEntry.safeParse({ ...base, h: 'sha256-abc=' }).success).toBe(true);
    expect(LockEntry.safeParse({ ...base, h: 'md5-abc' }).success).toBe(false);
  });
});
