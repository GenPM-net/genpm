// Repos Git fixture locales (file://) para tests: solo en tests se permite el protocolo file (security B.8).
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export type Files = Record<string, string | { content: string; mode?: number; symlink?: string }>;

const git = (cwd: string, ...args: string[]) =>
  execFileSync(
    'git',
    [
      '-c',
      'user.name=genpm',
      '-c',
      'user.email=t@genpm.net',
      '-c',
      'init.defaultBranch=main',
      '-c',
      'core.autocrlf=false',
      ...args,
    ],
    {
      cwd,
      env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1' },
    },
  )
    .toString()
    .trim();

export async function makeRepo(
  files: Files,
  opts: { tag?: string } = {},
): Promise<{ dir: string; url: string; sha: string; commit: (f: Files, tag?: string) => Promise<string> }> {
  const dir = await mkdtemp(join(tmpdir(), 'genpm-fixture-'));
  git(dir, 'init', '-q');
  git(dir, 'config', 'uploadpack.allowReachableSHA1InWant', 'true');
  git(dir, 'config', 'uploadpack.allowFilter', 'true');
  git(dir, 'config', 'uploadpack.allowAnySHA1InWant', 'true');
  const commit = async (f: Files, tag?: string) => {
    for (const [path, v] of Object.entries(f)) {
      const abs = join(dir, ...path.split('/'));
      await mkdir(dirname(abs), { recursive: true });
      if (typeof v === 'object' && v.symlink) {
        const { symlink } = await import('node:fs/promises');
        await symlink(v.symlink, abs);
      } else {
        await writeFile(abs, typeof v === 'string' ? v : v.content, {
          mode: typeof v === 'string' ? 0o644 : (v.mode ?? 0o644),
        });
      }
    }
    git(dir, 'add', '-A');
    git(dir, 'commit', '-q', '-m', 'fixture', '--no-verify');
    if (tag) git(dir, 'tag', tag);
    return git(dir, 'rev-parse', 'HEAD');
  };
  const sha = await commit(files, opts.tag);
  return { dir, url: pathToFileURL(dir).href, sha, commit };
}
