#!/usr/bin/env node
// genpm-mcp: servidor MCP por stdio. Nunca escribe en stdout fuera del protocolo (B.6).
import { serveStdio } from './serve.js';

await serveStdio();
