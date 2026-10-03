// Git endurecido (INV-2, security §2): nunca shell, nunca hooks, nunca submódulos, protocolos peligrosos
// deshabilitados, sin LFS ni prompts. Toda invocación de git del motor pasa por `runGit`.

import { execFile } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fail } from '../errors.js';

export type GitOptions = {
  cwd?: string;
  /** Solo tests: permite `file://` para repos fixture (security B.8). Nunca expuesto por CLI ni MCP. */
  allowFileProtocol?: boolean;
  timeoutMs?: number;
  /** Para depuración (`--verbose`). */
  log?: (line: string) => void;
};

let emptyHooksDir: string | null = null;

/** Directorio vacío para `core.hooksPath` (portátil: `/dev/null` no sirve en Windows). */
async function hooksDir(): Promise<string> {
  if (!emptyHooksDir) {
    emptyHooksDir = join(tmpdir(), 'genpm-empty-hooks');
    await mkdir(emptyHooksDir, { recursive: true });
  }
  return emptyHooksDir;
}

export async function hardeningFlags(opts: Pick<GitOptions, 'allowFileProtocol'> = {}): Promise<string[]> {
  return [
    '-c',
    `core.hooksPath=${await hooksDir()}`,
    '-c',
    'core.fsmonitor=false',
    '-c',
    'core.symlinks=false',
    '-c',
    'core.autocrlf=false',
    '-c',
    'core.eol=lf',
    '-c',
    'core.safecrlf=false',
    '-c',
    'protocol.ext.allow=never',
    '-c',
    `protocol.file.allow=${opts.allowFileProtocol ? 'always' : 'never'}`,
    '-c',
    'protocol.allow=user',
    '-c',
    'submodule.recurse=false',
    '-c',
    'fetch.recurseSubmodules=false',
    '-c',
    'advice.detachedHead=false',
    '-c',
    'init.defaultBranch=genpm',
    '-c',
    'filter.lfs.smudge=',
    '-c',
    'filter.lfs.process=',
    '-c',
    'filter.lfs.required=false',
    '-c',
    'transfer.fsckObjects=true',
  ];
}

export function hardenedEnv(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  // Solo lo imprescindible del entorno del usuario: PATH, HOME y credenciales (SSH agent, proxies) — ADR-012.
  for (const k of [
    'PATH',
    'Path',
    'HOME',
    'USERPROFILE',
    'SYSTEMROOT',
    'SystemRoot',
    'TMPDIR',
    'TEMP',
    'TMP',
    'SSH_AUTH_SOCK',
    'SSH_AGENT_PID',
    'HTTPS_PROXY',
    'https_proxy',
    'HTTP_PROXY',
    'http_proxy',
    'NO_PROXY',
    'no_proxy',
    'GIT_SSH_COMMAND',
    'GIT_ASKPASS',
    'SSL_CERT_FILE',
    'GIT_SSL_CAINFO',
    'LANG',
  ]) {
    if (base[k] !== undefined) env[k] = base[k];
  }
  return {
    ...env,
    GIT_TERMINAL_PROMPT: '0',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_LFS_SKIP_SMUDGE: '1',
    GIT_ALLOW_PROTOCOL: 'https:ssh:git+ssh',
    GCM_INTERACTIVE: 'never',
    LC_ALL: 'C',
  };
}

export type GitResult = { stdout: Buffer; stderr: string };

/** Ejecuta git con `execFile` (sin shell) y los flags de endurecimiento. */
export async function runGit(args: readonly string[], opts: GitOptions = {}): Promise<GitResult> {
  const flags = await hardeningFlags(opts);
  const env = hardenedEnv();
  if (opts.allowFileProtocol) env['GIT_ALLOW_PROTOCOL'] = 'https:ssh:git+ssh:file';
  opts.log?.(`git ${args.join(' ')}`);
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      [...flags, ...args],
      {
        cwd: opts.cwd,
        env,
        encoding: 'buffer',
        maxBuffer: 256 * 1024 * 1024,
        timeout: opts.timeoutMs ?? 60_000,
        windowsHide: true,
      },
      (err, stdout, stderr) => {
        const errText = stderr.toString('utf8');
        if (err) {
          if ((err as NodeJS.ErrnoException).code === 'ENOENT') reject(fail('E_GIT_MISSING'));
          else
            reject(
              fail('E_UPSTREAM_GIT', {
                detail: errText.trim().split('\n').slice(-2).join(' ').slice(0, 300) || err.message,
              }),
            );
          return;
        }
        resolve({ stdout, stderr: errText });
      },
    );
  });
}

/** `git --version` ≥ 2.25 (sparse-checkout). `null` si no hay git. */
export async function gitVersion(): Promise<string | null> {
  try {
    const { stdout } = await runGit(['--version']);
    return stdout.toString().match(/(\d+\.\d+\.\d+)/)?.[1] ?? null;
  } catch {
    return null;
  }
}

export function gitAtLeast(version: string | null, min = '2.25.0'): boolean {
  if (!version) return false;
  const a = version.split('.').map(Number);
  const b = min.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return true;
}
