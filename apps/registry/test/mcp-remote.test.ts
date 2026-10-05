// V03-04: MCP remoto de solo lectura por Streamable HTTP (cli-mcp-spec B.1).
import { SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { seed } from './helpers.js';

beforeEach(async () => {
  await seed();
});

const rpc = (body: unknown, host = 'mcp.genpm.net', path = '/') =>
  SELF.fetch(`https://${host}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify(body),
  });

type Rpc = {
  id: number;
  result?: Record<string, unknown> & { content?: Array<{ text: string }> };
  error?: { code: number };
};

describe('remote MCP (mcp.genpm.net)', () => {
  it('initializes, lists only read-only tools and answers ping', async () => {
    const init = await rpc({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'test', version: '1' } },
    });
    expect(init.status).toBe(200);
    expect(init.headers.get('access-control-allow-origin')).toBe('*');
    const r = (await init.json()) as Rpc;
    expect(r.result).toMatchObject({ protocolVersion: '2025-03-26', serverInfo: { name: 'genpm' } });
    expect(String(r.result!['instructions'])).toContain('read-only');

    expect((await rpc({ jsonrpc: '2.0', method: 'notifications/initialized' })).status).toBe(202);
    const list = (await (await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/list' })).json()) as Rpc;
    const tools = (list.result!['tools'] as Array<{ name: string; annotations: { readOnlyHint: boolean } }>).map(
      (t) => [t.name, t.annotations.readOnlyHint],
    );
    expect(tools).toEqual([
      ['genpm_search', true],
      ['genpm_info', true],
    ]);
    // Batch y /mcp en el host del API.
    const batch = (await (
      await rpc(
        [
          { jsonrpc: '2.0', id: 3, method: 'ping' },
          { jsonrpc: '2.0', id: 4, method: 'genpm/nope' },
        ],
        'api.genpm.net',
        '/mcp',
      )
    ).json()) as Rpc[];
    expect(batch.map((b) => b.result ?? b.error?.code)).toEqual([{}, -32601]);
  });

  it('searches and returns package info without counting an install', async () => {
    const s = (await (
      await rpc({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'genpm_search', arguments: { query: 'auth' } },
      })
    ).json()) as Rpc;
    expect(s.result!.content![0]!.text).toContain('@core/auth@1.2.0');

    const i = (await (
      await rpc({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'genpm_info', arguments: { name: '@core/auth' } },
      })
    ).json()) as Rpc;
    const structured = i.result!['structuredContent'] as { manifest: Record<string, unknown>; install: string };
    expect(structured.manifest['n']).toBe('@core/auth');
    expect(structured.manifest['sg']).toBeUndefined();
    expect(structured.install).toBe('npx -y @genpm-net/cli add @core/auth@1.2.0');

    const missing = (await (
      await rpc({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'genpm_info', arguments: { name: '@core/nope' } },
      })
    ).json()) as Rpc;
    expect(missing.result!['isError']).toBe(true);
    expect(missing.result!.content![0]!.text).toMatch(/^E_NOT_FOUND/);

    const unknown = (await (
      await rpc({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'genpm_add', arguments: {} } })
    ).json()) as Rpc;
    expect(unknown.error?.code).toBe(-32602);
  });

  it('rejects GET streams and malformed bodies', async () => {
    const get = await SELF.fetch('https://mcp.genpm.net/', { headers: { accept: 'text/event-stream' } });
    expect(get.status).toBe(405);
    const html = await SELF.fetch('https://mcp.genpm.net/', { headers: { accept: 'text/html' }, redirect: 'manual' });
    expect(html.status).toBe(302);
    const bad = await SELF.fetch('https://mcp.genpm.net/', { method: 'POST', body: '{nope' });
    expect(((await bad.json()) as { error: { code: number } }).error.code).toBe(-32700);
  });
});
