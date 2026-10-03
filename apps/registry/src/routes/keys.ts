// GET /v1/keys: claves públicas vigentes + lista de revocación firmada por la clave raíz offline (api-spec §4).
import { Hono } from 'hono';
import type { AppEnv } from '../env.js';

export const keys = new Hono<AppEnv>().get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, public_key, status, created_at, revoked_at FROM signing_keys WHERE status != 'retired' ORDER BY created_at",
  ).all<{ id: string; public_key: string; status: string; created_at: number; revoked_at: number | null }>();
  const revocation = await c.env.DB.prepare("SELECT value FROM registry_meta WHERE key = 'revocation_list'").first<{ value: string }>();
  c.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
  return c.json({
    alg: 'Ed25519',
    keys: results.map((k) => ({
      keyid: k.id,
      publicKey: k.public_key,
      status: k.status,
      createdAt: new Date(k.created_at).toISOString(),
      revokedAt: k.revoked_at ? new Date(k.revoked_at).toISOString() : null,
    })),
    revocation: revocation ? JSON.parse(revocation.value) : null,
  });
});
