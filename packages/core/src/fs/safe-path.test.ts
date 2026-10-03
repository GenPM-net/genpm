import { chmod, link, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import fc from 'fast-check';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { safeDestPath, safePath } from './safe-path.js';

let root: string;
let outside: string;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'genpm-safe-'));
  outside = await mkdtemp(join(tmpdir(), 'genpm-out-'));
  await mkdir(join(root, 'src/lib'), { recursive: true });
  await writeFile(join(root, 'src/file.ts'), '');
  await writeFile(join(outside, 'secret'), 'x');
  await symlink('/', join(root, 'src/to-root'));
  await symlink('..', join(root, 'src/to-parent'));
  await symlink(outside, join(root, 'linked-out'));
  await symlink(join(root, 'src'), join(root, 'linked-in'));
  await link(join(outside, 'secret'), join(root, 'src/hardlink'));
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
  await rm(outside, { recursive: true, force: true });
});

async function code(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (e) {
    return (e as { details?: { params?: { reason?: string } } }).details?.params?.reason ?? String(e);
  }
}

describe('safePath · security §8.2 corpus', () => {
  const corpus: Array<[string, string]> = [
    ['../x', 'dotdot_segment'],
    ['..\\x', 'backslash'],
    ['%2e%2e/x', 'encoded_traversal'],
    ['src/../../x', 'dotdot_segment'],
    ['/etc/x', 'absolute'],
    ['C:\\x', 'backslash'],
    ['\\\\server\\share', 'backslash'],
    ['~/x', 'home'],
    ['src/\u0000x', 'control_char'],
    ['src/CON', 'windows_reserved'],
    ['src/aux.ts', 'windows_reserved'],
    ['src/x.', 'trailing_dot_or_space'],
    ['src/x ', 'trailing_dot_or_space'],
    ['src/e\u0301', 'not_nfc'],
    [`src/${'a'.repeat(300)}/x`, 'ok-or-fs'],
    ['src/to-root/etc/passwd', 'symlink'],
    ['src/to-parent/x', 'symlink'],
    ['linked-out/secret', 'symlink'],
    ['linked-in/x', 'symlink'],
    ['src/file.ts/x', 'not_a_directory'],
  ];
  for (const [input, reason] of corpus) {
    it(`${JSON.stringify(input).slice(0, 40)} → ${reason}`, async () => {
      const r = await code(safePath(root, input));
      if (reason === 'ok-or-fs') expect(r === null || /ENAMETOOLONG/.test(r)).toBe(true);
      else expect(r).toBe(reason);
    });
  }

  it('accepts new and existing paths inside the root', async () => {
    expect(await safePath(root, 'src/lib/auth/index.ts')).toMatch(/src[/\\]lib[/\\]auth[/\\]index\.ts$/);
    expect(await safePath(root, 'src/file.ts')).toMatch(/file\.ts$/);
    expect(await safePath(root, 'src/lib')).toMatch(/lib$/);
  });

  it('hardlinked targets resolve inside the root (writes replace the entry atomically, never write through)', async () => {
    expect(await code(safePath(root, 'src/hardlink'))).toBeNull();
  });

  it.skipIf(process.platform === 'win32')('rejects special files', async () => {
    const { execFileSync } = await import('node:child_process');
    execFileSync('mkfifo', [join(root, 'src/fifo')]);
    expect(await code(safePath(root, 'src/fifo'))).toBe('special_file');
  });

  it.skipIf(process.platform === 'win32' || process.getuid?.() === 0)('propagates permission errors', async () => {
    await mkdir(join(root, 'locked/inner'), { recursive: true });
    await chmod(join(root, 'locked'), 0o000);
    try {
      expect(await code(safePath(root, 'locked/inner/x'))).toMatch(/EACCES/);
    } finally {
      await chmod(join(root, 'locked'), 0o755);
    }
  });

  it('safeDestPath rejects reserved directories', async () => {
    expect(await code(safeDestPath(root, '.git/hooks/pre-commit'))).toBe('reserved_dir');
    expect(await code(safeDestPath(root, 'NODE_MODULES/x'))).toBe('reserved_dir');
    expect(await code(safeDestPath(root, '.genpm/files/x.json'))).toBe('reserved_dir');
    expect(await code(safeDestPath(root, 'src/lib/x'))).toBeNull();
    expect(await code(safeDestPath(root, '.genpm/x', []))).toBeNull();
  });
});

describe('safePath · properties (fast-check)', () => {
  it('never returns a path outside the root', async () => {
    const seg = fc.oneof(
      fc.constantFrom(
        '..',
        '.',
        '',
        '~',
        'C:',
        '\\',
        '%2e%2e',
        'src',
        'lib',
        'to-root',
        'linked-out',
        'é',
        'e\u0301',
        'CON',
      ),
      fc.stringMatching(/^[a-z]{1,6}$/),
    );
    await fc.assert(
      fc.asyncProperty(fc.array(seg, { minLength: 1, maxLength: 6 }), async (segs) => {
        const rel = segs.join('/');
        try {
          const abs = await safePath(root, rel);
          const { realpath } = await import('node:fs/promises');
          const realRoot = await realpath(root);
          expect(abs.startsWith(realRoot)).toBe(true);
          expect(rel.split('/')).not.toContain('..');
        } catch (e) {
          expect((e as { code?: string }).code).toBe('E_PATH_UNSAFE');
        }
      }),
      { numRuns: 300 },
    );
  });

  it('rejects arbitrary unicode containing control or bidi characters', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20, unit: 'grapheme' }),
        fc.constantFrom('\u0007', '\u202e', '\u200b', '\u{e0041}'),
        async (s, bad) => {
          const r = await code(safePath(root, `src/${s}${bad}`));
          expect(r).not.toBeNull();
        },
      ),
      { numRuns: 200 },
    );
  });
});
