import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

describe('GET /v1/health', () => {
  it('responds ok with the D1 binding and a request id', async () => {
    const res = await SELF.fetch('https://api.genpm.net/v1/health');
    expect(res.status).toBe(200);
    expect(res.headers.get('genpm-request-id')).toMatch(/^[0-9A-Z]{26}$/);
    expect(res.headers.get('strict-transport-security')).toContain('max-age');
    expect(await res.json()).toMatchObject({ ok: true, db: 'ok', env: 'test' });
  });
});

describe('problem+json', () => {
  it('returns E_NOT_FOUND for unknown routes, localized by Accept-Language', async () => {
    const res = await SELF.fetch('https://api.genpm.net/v1/nope', { headers: { 'accept-language': 'es-MX,es;q=0.9' } });
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/problem+json');
    expect(res.headers.get('content-language')).toBe('es');
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ code: 'E_NOT_FOUND', status: 404, type: 'https://genpm.net/errors/E_NOT_FOUND' });
    expect(body['title']).toBe('No se encontró /v1/nope.');
    expect(body['requestId']).toBe(res.headers.get('genpm-request-id'));
  });
  it('rejects bodies over 16 KB', async () => {
    const res = await SELF.fetch('https://api.genpm.net/v1/publish', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': String(17 * 1024) },
      body: 'x'.repeat(17 * 1024),
    });
    expect(res.status).toBe(413);
    expect(((await res.json()) as { code: string }).code).toBe('E_PAYLOAD_TOO_LARGE');
  });
  it('rejects an invalid tenant header and unknown tenants with 404', async () => {
    expect((await SELF.fetch('https://api.genpm.net/v1/x', { headers: { 'genpm-registry': 'BAD!' } })).status).toBe(
      400,
    );
    expect((await SELF.fetch('https://api.genpm.net/v1/x', { headers: { 'genpm-registry': 'acme' } })).status).toBe(
      404,
    );
  });
  it('answers CORS preflight: * for reads, web origin for writes', async () => {
    const pub = await SELF.fetch('https://api.genpm.net/v1/search', { method: 'OPTIONS' });
    expect(pub.headers.get('access-control-allow-origin')).toBe('*');
    expect(pub.headers.get('access-control-allow-methods')).not.toContain('POST');
    const web = await SELF.fetch('https://api.genpm.net/v1/tokens', {
      method: 'OPTIONS',
      headers: { origin: 'https://genpm.net' },
    });
    expect(web.headers.get('access-control-allow-origin')).toBe('https://genpm.net');
    expect(web.headers.get('access-control-allow-credentials')).toBe('true');
  });
});
