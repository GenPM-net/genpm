// V10-01: cliente de registros privados, equipos y accesos (validación local + rutas del registry).
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { accessGrant, registryCreate, registryMember, teamCreate, teamMember } from '../src/rbac.js';

describe('rbac client', () => {
  it('maps commands to registry routes and validates input before calling', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'genpm-rbac-'));
    const calls: string[] = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method} ${new URL(url).pathname}${new URL(url).search} ${init?.body ?? ''}`);
      return Response.json({ ok: true, slug: 'acme', url: 'https://api.genpm.net/r/acme' });
    }) as typeof fetch;
    const o = { cwd, home: cwd, registry: 'https://api.genpm.net', token: 'gpm_x', fetchImpl };
    await registryCreate({ ...o, slug: 'acme', owner: '@acme' });
    await registryMember({ ...o, slug: 'acme', handle: 'bob', role: 'reader' });
    await registryMember({ ...o, slug: 'acme', handle: 'bob', role: null });
    await teamCreate({ ...o, ref: 'acme/backend' });
    await teamMember({ ...o, ref: 'acme/backend', handle: 'bob', role: 'maintainer' });
    await accessGrant({ ...o, name: '@acme/api', principal: 'team:acme/backend', permission: 'read' });
    await accessGrant({ ...o, name: '@acme/api', principal: 'user:bob', permission: null });
    expect(calls).toEqual([
      'POST /v1/registries {"slug":"acme","owner":"acme"}',
      'PUT /v1/registries/acme/members/bob {"role":"reader"}',
      'DELETE /v1/registries/acme/members/bob ',
      'POST /v1/orgs/acme/teams {"slug":"backend"}',
      'PUT /v1/orgs/acme/teams/backend/members/bob {"role":"maintainer"}',
      'PUT /v1/packages/@acme/api/grants {"principal":"team:acme/backend","permission":"read"}',
      'DELETE /v1/packages/@acme/api/grants?principal=user%3Abob ',
    ]);
    for (const bad of [
      () => registryCreate({ ...o, slug: 'A B', owner: 'acme' }),
      () => teamCreate({ ...o, ref: 'nope' }),
      () => accessGrant({ ...o, name: '@acme/api', principal: 'everyone', permission: 'read' }),
      () => accessGrant({ ...o, name: 'acme', principal: 'user:bob', permission: 'read' }),
    ])
      await expect(bad()).rejects.toMatchObject({ code: 'E_USAGE' });
    expect(calls).toHaveLength(7);
  });
});
