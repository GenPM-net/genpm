// Límite de frecuencia en ventana fija sobre Postgres (un UPSERT atómico por petición).
import { lt, sql } from 'drizzle-orm';
import { type Executor, getDb } from '../db/index.ts';
import { hmacHex } from './crypto.ts';
import { rateLimits } from './schema.ts';

export type RateLimitResult = { ok: boolean; remaining: number; resetAt: Date; retryAfterSeconds: number };

/**
 * Cuenta un intento para `key` (p. ej. `forms:contact:<ip>`) y dice si está dentro de `limit` por `windowMs`.
 * La clave se guarda como HMAC con `ANTISPAM_SECRET`: ni IPs ni emails en claro.
 */
export async function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number; now?: Date; secret?: string },
  db: Executor = getDb(),
): Promise<RateLimitResult> {
  const now = opts.now ?? new Date();
  const windowStart = new Date(Math.floor(now.getTime() / opts.windowMs) * opts.windowMs);
  const resetAt = new Date(windowStart.getTime() + opts.windowMs);
  const hashed = await hmacHex(antispamSecret(opts.secret), key);
  const [row] = await db
    .insert(rateLimits)
    .values({ key: hashed, windowStart, count: 1, expiresAt: resetAt })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${rateLimits.windowStart} = excluded.window_start then ${rateLimits.count} + 1 else 1 end`,
        windowStart: sql`excluded.window_start`,
        expiresAt: sql`excluded.expires_at`,
      },
    })
    .returning({ count: rateLimits.count });
  const count = row?.count ?? 1;
  return {
    ok: count <= opts.limit,
    remaining: Math.max(0, opts.limit - count),
    resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((resetAt.getTime() - now.getTime()) / 1000)),
  };
}

/** Borra ventanas caducadas (prográmalo a diario con @core/jobs). */
export async function pruneRateLimits(now = new Date(), db: Executor = getDb()): Promise<number> {
  const rows = await db.delete(rateLimits).where(lt(rateLimits.expiresAt, now)).returning({ key: rateLimits.key });
  return rows.length;
}

export function antispamSecret(given?: string): string {
  const s = given ?? process.env.ANTISPAM_SECRET;
  if (!s || s.length < 32) throw new Error('ANTISPAM_SECRET must be set (>= 32 chars)');
  return s;
}
