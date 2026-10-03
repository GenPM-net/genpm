import { describe, expect, it } from 'vitest';
import { account, call, seed } from './helpers.js';

async function yank(token: string, spec: string, reason = 'CVE-2026-1234 in session.ts') {
  const [name, version] = [spec.slice(0, spec.lastIndexOf('@')), spec.slice(spec.lastIndexOf('@') + 1)];
  const res = await call(`/v1/packages/${name}/versions/${version}/yank`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

describe('POST …/yank (api-spec §4.6)', () => {
  it('withdraws a version, moves latest and keeps it immutable', async () => {
    await seed();
    const staff = await account({ login: 'yanker', staff: true });
    // Los fixtures pertenecen a la cuenta de sistema: el staff tiene rol admin en ella.
    const r = await yank(staff.token, '@core/db@1.0.3');
    expect(r).toEqual({ status: 200, body: { ok: true, latest: '1.0.0' } });
    const resolved = (await (await call(`/v1/resolve/@core/db?range=%5E1&fmt=c&t=${Date.now()}`)).json()) as {
      root: { v: string };
    };
    expect(resolved.root.v).toBe('1.0.0');
    const exact = (await (await call(`/v1/resolve/@core/db?range=1.0.3&fmt=c&t=${Date.now()}`)).json()) as {
      root: { v: string };
      w: Array<{ code: string }>;
    };
    expect(exact.root.v).toBe('1.0.3');
    expect(exact.w.map((w) => w.code)).toContain('W_YANKED');
  });
  it('hides packages the actor cannot write (404, not 403) and validates the reason', async () => {
    await seed();
    const stranger = await account({ login: 'stranger2' });
    expect((await yank(stranger.token, '@core/db@1.0.0')).status).toBe(404);
    const staff = await account({ login: 'yanker2', staff: true });
    expect((await yank(staff.token, '@core/db@1.0.0', 'x')).body['code']).toBe('E_BAD_REQUEST');
    expect((await yank(staff.token, '@core/db@9.9.9')).body['code']).toBe('E_NO_MATCHING_VERSION');
  });
});
