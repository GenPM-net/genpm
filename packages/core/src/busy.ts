// Candado `.genpm/.lock` (cli-mcp-spec §0): PID + timestamp; huérfano tras 10 min o si el proceso ya no existe.
// CLI y MCP escribiendo a la vez ⇒ E_BUSY.

import { mkdir, open, readFile, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fail } from './errors.js';
import { safePath } from './fs/safe-path.js';
import { BUSY_LOCK } from './lock.js';

const STALE_MS = 10 * 60_000;

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM';
  }
}

export async function acquire(root: string): Promise<() => Promise<void>> {
  const path = await safePath(root, BUSY_LOCK);
  await mkdir(dirname(path), { recursive: true });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fh = await open(path, 'wx', 0o644);
      await fh.writeFile(JSON.stringify({ pid: process.pid, ts: Date.now() }));
      await fh.close();
      return async () => {
        await rm(path, { force: true });
      };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
      let stale = true;
      try {
        const { pid, ts } = JSON.parse(await readFile(path, 'utf8')) as { pid: number; ts: number };
        stale = Date.now() - ts > STALE_MS || !alive(pid);
      } catch {
        stale = true;
      }
      if (!stale) throw fail('E_BUSY');
      await rm(path, { force: true });
    }
  }
  throw fail('E_BUSY');
}

export async function withLock<T>(root: string, fn: () => Promise<T>): Promise<T> {
  const release = await acquire(root);
  try {
    return await fn();
  } finally {
    await release();
  }
}
