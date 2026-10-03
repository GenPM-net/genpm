// Runbook §3: modo solo lectura por incidente. Con READ_ONLY=1 se lee e instala, ninguna escritura pasa.
import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import worker from '../src/index.js';
import { seed } from './helpers.js';

async function callRO(path: string, init: RequestInit = {}): Promise<Response> {
  const ctx = createExecutionContext();
  const res = await worker.fetch(
    new Request(`https://api.genpm.net${path}`, init) as never,
    { ...env, READ_ONLY: '1' },
    ctx,
  );
  await waitOnExecutionContext(ctx);
  return res as unknown as Response;
}

beforeAll(() => seed());

describe('READ_ONLY=1', () => {
  it('keeps reads and installs working', async () => {
    expect((await callRO('/v1/resolve/@core/db?range=latest&ro=1')).status).toBe(200);
    expect((await callRO('/v1/search?q=auth&ro=1')).status).toBe(200);
    expect((await callRO('/v1/health')).status).toBe(200);
  });
  it('rejects every write with 503 E_READ_ONLY before authentication', async () => {
    for (const [path, method] of [
      ['/v1/publish', 'POST'],
      ['/v1/packages/@core/db/1.0.3/yank', 'POST'],
      ['/v1/tokens', 'POST'],
      ['/v1/reports', 'POST'],
    ] as const) {
      const res = await callRO(path, { method, headers: { 'content-type': 'application/json' }, body: '{}' });
      expect(res.status, path).toBe(503);
      expect(((await res.json()) as { code: string }).code).toBe('E_READ_ONLY');
    }
  });
});
