import { describe, expect, it } from 'vitest';
import { createFileFilter, relativeToInclude } from './files.js';

describe('file filter (manifest-spec §5.5)', () => {
  it('always excludes VCS, CI, deps, manifest and env files', () => {
    const inc = createFileFilter();
    for (const p of [
      '.git/config',
      '.github/workflows/x.yml',
      'node_modules/a/index.js',
      'genpm.json',
      '.genpmignore',
      '.env',
      '.env.local',
      'sub/.env',
    ]) {
      expect(inc(p), p).toBe(false);
    }
    expect(inc('index.ts')).toBe(true);
    expect(inc('AGENTS.md')).toBe(true);
    expect(inc('')).toBe(false);
    expect(inc('../x')).toBe(false);
  });
  it('applies .genpmignore', () => {
    const inc = createFileFilter('tests/\n*.test.ts\nCHANGELOG.md\n!keep.test.ts');
    expect(inc('tests/a.ts')).toBe(false);
    expect(inc('src/a.test.ts')).toBe(false);
    expect(inc('keep.test.ts')).toBe(true);
    expect(inc('CHANGELOG.md')).toBe(false);
    expect(inc('src/a.ts')).toBe(true);
  });
  it('maps repo paths into the include dir', () => {
    expect(relativeToInclude('.', 'a/b.ts')).toBe('a/b.ts');
    expect(relativeToInclude('packages/auth', 'packages/auth/src/x.ts')).toBe('src/x.ts');
    expect(relativeToInclude('packages/auth/', 'packages/auth/x.ts')).toBe('x.ts');
    expect(relativeToInclude('packages/auth', 'packages/authz/x.ts')).toBeNull();
  });
});
