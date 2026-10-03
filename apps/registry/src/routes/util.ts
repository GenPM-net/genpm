import type { Context } from 'hono';
import { Repo } from '../db/repo.js';
import type { AppEnv } from '../env.js';

export const repoOf = (c: Context<AppEnv>) => new Repo(c.env.DB, c.get('tenant'));

/** Forma compacta si `?fmt=c` o `Accept: application/vnd.genpm+json` (api-spec §1). */
export function wantsCompact(c: Context<AppEnv>): boolean {
  return c.req.query('fmt') === 'c' || (c.req.header('accept') ?? '').includes('application/vnd.genpm+json');
}

export function encodeCursor(offset: number): string {
  return btoa(JSON.stringify({ o: offset }))
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export function decodeCursor(cursor: string | undefined): number {
  if (!cursor) return 0;
  try {
    const o = (JSON.parse(atob(cursor.replace(/-/g, '+').replace(/_/g, '/'))) as { o?: unknown }).o;
    return typeof o === 'number' && Number.isInteger(o) && o >= 0 && o <= 10_000 ? o : 0;
  } catch {
    return 0;
  }
}

export function fullName(c: Context<AppEnv>): string {
  return `${c.req.param('scope')}/${c.req.param('name')}`;
}
