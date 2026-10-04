// Arranque del servidor MCP por stdio, compartido por `npx -y @genpm-net/mcp` (bin.ts) y por `genpm mcp serve` del binario
// nativo (ADR-025). Nunca escribe en stdout fuera del protocolo (B.6).
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer, type ServerOptions } from './server.js';

export async function serveStdio(options: ServerOptions = {}) {
  const server = createServer(options);
  await server.connect(new StdioServerTransport());
  return server;
}
