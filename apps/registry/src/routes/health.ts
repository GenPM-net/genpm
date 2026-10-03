import { Hono } from 'hono';
import type { AppEnv } from '../env.js';

export const VERSION = '0.1.0';

export const health = new Hono<AppEnv>().get('/', async (c) => {
  const started = Date.now();
  let db: 'ok' | 'error' = 'ok';
  try {
    await c.env.DB.prepare('SELECT 1').first();
  } catch {
    db = 'error';
  }
  c.header('Cache-Control', 'no-store');
  return c.json(
    { ok: db === 'ok', version: VERSION, env: c.env.ENVIRONMENT, db, ms: Date.now() - started },
    db === 'ok' ? 200 : 503,
  );
});
