#!/usr/bin/env node
// genpm-mcp: servidor MCP por stdio. Nunca escribe en stdout fuera del protocolo (B.6).
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';

const server = createServer();
await server.connect(new StdioServerTransport());
