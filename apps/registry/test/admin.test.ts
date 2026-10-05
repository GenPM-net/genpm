// ADR-027: GET /v1/admin/analytics solo para staff; sin CF_AE_TOKEN devuelve los datos de D1 y configured=false.
import { describe, expect, it } from 'vitest';
import { account, call, seed } from './helpers.js';

describe('GET /v1/admin/analytics', () => {
  it('hides the route from anonymous users and non-staff accounts', async () => {
    await seed();
    expect((await call('/v1/admin/analytics')).status).toBe(401);
    const { token } = await account({ login: 'visitor' });
    const res = await call('/v1/admin/analytics', { headers: { authorization: `Bearer ${token}` } });
    expect(res.status).toBe(404);
  });
  it('returns registry activity to staff and never caches it', async () => {
    const { token } = await account({ login: 'founder', staff: true });
    const res = await call('/v1/admin/analytics?days=500', { headers: { authorization: `Bearer ${token}` } });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    const body = (await res.json()) as { days: number; configured: boolean; registry: Array<{ action: string }> };
    expect(body.days).toBe(90);
    expect(body.configured).toBe(false);
    expect(body.registry.some((r) => r.action === 'account.create')).toBe(true);
  });
});
