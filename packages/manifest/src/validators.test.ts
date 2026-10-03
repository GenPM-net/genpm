import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  checkContextPath,
  checkDest,
  checkInclude,
  checkRef,
  checkRelativePath,
  isImmutableRef,
  isSha,
  isValidName,
  isValidScope,
  isValidVersion,
  parseName,
  slugOf,
} from './validators.js';

describe('checkDest (manifest-spec §4 + security §8.2)', () => {
  const cases: Array<[string, string | null]> = [
    ['src/lib/auth', null],
    ['packages/auth', null],
    ['src/features/x-y_z', null],
    ['', 'empty'],
    ['a'.repeat(201), 'too_long'],
    ['a/b/c/d/e/f/g/h/i', 'too_deep'],
    ['/etc/x', 'absolute'],
    ['~/x', 'home'],
    ['..\\x', 'backslash'],
    ['C:\\x', 'backslash'],
    ['\\\\server\\share', 'backslash'],
    ['C:x', 'colon'],
    ['src/\u0000x', 'control_char'],
    ['src/\u202Ex', 'invisible_char'],
    ['src/\u{E0041}x', 'invisible_char'],
    ['src/e\u0301', 'not_nfc'],
    ['src//x', 'empty_segment'],
    ['src/', 'empty_segment'],
    ['.', 'dot_segment'],
    ['src/./x', 'dot_segment'],
    ['../x', 'dotdot_segment'],
    ['src/../../x', 'dotdot_segment'],
    ['%2e%2e/x', 'encoded_traversal'],
    ['src/%2E/x', 'encoded_traversal'],
    ['src/a%2Fb', 'encoded_traversal'],
    ['src/%E0%A4%A', null],
    ['src/100%', null],
    ['src/CON', 'windows_reserved'],
    ['src/aux.ts', 'windows_reserved'],
    ['src/com1', 'windows_reserved'],
    ['src/x.', 'trailing_dot_or_space'],
    ['src/x ', 'trailing_dot_or_space'],
    ['.git/hooks', 'reserved_dir'],
    ['.GIT/hooks', 'reserved_dir'],
    ['node_modules/x', 'reserved_dir'],
    ['.genpm', 'reserved_dir'],
    ['.github', 'reserved_dir'],
    ['.vscode', 'reserved_dir'],
    ['.cursor', 'reserved_dir'],
    ['.github/workflows', null],
    ['.cursor/rules', null],
  ];
  for (const [input, expected] of cases) {
    it(`${JSON.stringify(input).slice(0, 40)} → ${expected}`, () => {
      expect(checkDest(input)).toBe(expected);
    });
  }

  it('never accepts a path that escapes or is absolute (property)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom('a', '..', '.', '', '/', '\\', ':', '~', 'b', '%2e', 'é'), { maxLength: 8 }),
        (parts) => {
          const p = parts.join('/');
          if (checkDest(p) === null) {
            expect(p.split('/')).not.toContain('..');
            expect(p.startsWith('/')).toBe(false);
            expect(p.includes('\\')).toBe(false);
          }
        },
      ),
    );
  });

  it('accepts any well-formed relative path (property)', () => {
    fc.assert(
      fc.property(fc.array(fc.stringMatching(/^[a-z][a-z0-9_-]{0,10}$/), { minLength: 1, maxLength: 8 }), (segs) => {
        const p = segs.join('/');
        const first = segs[0]!;
        if (['node_modules', 'con', 'prn', 'aux', 'nul'].includes(first)) return;
        if (segs.some((s) => /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(s))) return;
        expect(checkDest(p)).toBeNull();
      }),
    );
  });
});

describe('checkRelativePath limits', () => {
  it('has no limits by default', () => {
    expect(checkRelativePath(`${'a/'.repeat(50)}b`)).toBeNull();
  });
});

describe('checkInclude / checkContextPath', () => {
  it('accepts "." and nested dirs', () => {
    expect(checkInclude('.')).toBeNull();
    expect(checkInclude('packages/auth')).toBeNull();
    expect(checkInclude('../x')).toBe('dotdot_segment');
  });
  it('keeps x inside i', () => {
    expect(checkContextPath('AGENTS.md')).toBeNull();
    expect(checkContextPath('docs/AGENTS.md')).toBeNull();
    expect(checkContextPath('../AGENTS.md')).toBe('dotdot_segment');
  });
});

describe('checkRef', () => {
  const cases: Array<[string, string | null]> = [
    ['v1.2.0', null],
    ['auth@0.3.0', null],
    ['release-2026.10', null],
    ['refs/tags/v1.0.0', null],
    ['a'.repeat(40), null],
    ['b'.repeat(64), null],
    ['', 'empty'],
    ['v'.repeat(129), 'too_long'],
    ['9f2c4e1', 'short_sha'],
    ['main', 'branch'],
    ['master', 'branch'],
    ['HEAD', 'branch'],
    ['refs/heads/v1', 'branch'],
    ['origin/main', 'branch'],
    ['refs/tags/main', 'branch'],
    ['feature/login', 'branch'],
    ['-v1', 'invalid_format'],
    ['/v1', 'invalid_format'],
    ['v1/', 'invalid_format'],
    ['v1.', 'invalid_format'],
    ['v1.lock', 'invalid_format'],
    ['v1..2', 'invalid_format'],
    ['v1@{0}', 'invalid_format'],
    ['a//b', 'invalid_format'],
    ['@', 'invalid_format'],
    ['v 1', 'invalid_format'],
    ['v1~1', 'invalid_format'],
    ['v1^', 'invalid_format'],
    ['v1:x', 'invalid_format'],
    ['v1?', 'invalid_format'],
    ['v1*', 'invalid_format'],
    ['v1[', 'invalid_format'],
    ['v1\\x', 'invalid_format'],
    ['a/.hidden', 'invalid_format'],
    ['refs/tags/', 'invalid_format'],
  ];
  for (const [input, expected] of cases) {
    it(`${input.slice(0, 30) || '(empty)'} → ${expected}`, () => {
      expect(checkRef(input)).toBe(expected);
    });
  }
  it('isImmutableRef mirrors checkRef', () => {
    expect(isImmutableRef('v1.0.0')).toBe(true);
    expect(isImmutableRef('main')).toBe(false);
  });
});

describe('names, versions and SHAs', () => {
  it('validates names', () => {
    expect(isValidName('@core/auth')).toBe(true);
    expect(isValidName('@core/Auth')).toBe(false);
    expect(isValidName('core/auth')).toBe(false);
    expect(isValidName(`@${'a'.repeat(40)}/x`)).toBe(false);
    expect(isValidScope('core')).toBe(true);
    expect(isValidScope('-core')).toBe(false);
  });
  it('parses names and slugs', () => {
    expect(parseName('@core/auth')).toEqual({ scope: 'core', name: 'auth' });
    expect(parseName('nope')).toBeNull();
    expect(slugOf('@core/auth')).toBe('core__auth');
  });
  it('validates versions strictly', () => {
    expect(isValidVersion('1.2.0')).toBe(true);
    expect(isValidVersion('2.0.0-beta.1')).toBe(true);
    expect(isValidVersion('v1.2.0')).toBe(false);
    expect(isValidVersion('1.2')).toBe(false);
    expect(isValidVersion('01.2.0')).toBe(false);
    expect(isValidVersion('1.0.0+meta')).toBe(false);
  });
  it('validates SHAs', () => {
    expect(isSha('a'.repeat(40))).toBe(true);
    expect(isSha('A'.repeat(40))).toBe(false);
    expect(isSha('a'.repeat(39))).toBe(false);
  });
});
