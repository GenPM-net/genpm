// V03-02: Verified Archive — al publicar, el tar.gz del commit queda en R2 con un registro firmado.
import { env } from 'cloudflare:test';
import { archiveRecord, parseSignatureHeader, sha256Hex, verifyManifest } from '@genpm/manifest';
import { beforeEach, describe, expect, it } from 'vitest';
import { FakeGitHub } from './fake-github.js';
import { account, call, DEV_KEY, wipeScope } from './helpers.js';

const SHA = 'c1b2c3d4e5f60718293a4b5c6d7e8f9012345678';

function fake() {
  return new FakeGitHub().addRepo('arch/kit', {
    id: 77,
    license: 'MIT',
    tags: { 'v1.0.0': SHA },
    commits: {
      [SHA]: {
        'genpm.json': JSON.stringify({ n: '@arch/kit', v: '1.0.0', d: 'src/lib/kit', s: 'Kit', l: 'MIT' }),
        'AGENTS.md': '# kit\n\n## Purpose\nx\n',
        'index.ts': 'export {};\n',
      },
    },
  });
}

let token: string;
beforeEach(async () => {
  await wipeScope('arch');
  ({ token } = await account({
    login: `ar${Math.random().toString(36).slice(2, 7)}`,
    orgs: [{ login: 'arch', role: 'admin' }],
  }));
});

describe('GET /v1/archive', () => {
  it('serves the mirrored tarball with a verifiable signature', async () => {
    const pub = await call(
      '/v1/publish',
      {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          name: '@arch/kit',
          version: '1.0.0',
          repo: 'https://github.com/arch/kit',
          ref: 'v1.0.0',
        }),
      },
      fake(),
    );
    expect(pub.status).toBe(201);
    const row = await env.DB.prepare('SELECT archive_sha256, archive_size FROM package_versions WHERE commit_sha = ?1')
      .bind(SHA)
      .first<{ archive_sha256: string; archive_size: number }>();
    expect(row!.archive_sha256).toMatch(/^[0-9a-f]{64}$/);
    const res = await call('/v1/archive/@arch/kit/1.0.0');
    expect(res.status).toBe(200);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const h = await sha256Hex(bytes);
    expect(h).toBe(res.headers.get('genpm-archive-sha256'));
    expect(bytes.byteLength).toBe(row!.archive_size);
    const sg = parseSignatureHeader(res.headers.get('genpm-archive-signature'))!;
    const ok = await verifyManifest(archiveRecord({ n: '@arch/kit', v: '1.0.0', c: SHA, h }), sg, {
      [DEV_KEY.id]: DEV_KEY.public,
    });
    expect(ok.ok).toBe(true);
    // Un sha256 distinto no verifica.
    const bad = await verifyManifest(archiveRecord({ n: '@arch/kit', v: '1.0.0', c: SHA, h: '0'.repeat(64) }), sg, {
      [DEV_KEY.id]: DEV_KEY.public,
    });
    expect(bad.ok).toBe(false);
    expect((await call('/v1/archive/@arch/kit/9.9.9')).status).toBe(404);
  });
});
