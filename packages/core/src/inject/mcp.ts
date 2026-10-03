// Writer de config MCP del proyecto (architecture §7.4, ADR-009). Merge JSON no destructivo: si ya existe un servidor
// con el mismo nombre y distinta config ⇒ aviso y no se sobrescribe. Los `env` se escriben como referencias, nunca valores.
// INV-5: solo se llama con consentimiento explícito (`allowMcp`).

import { type McpServerEntry, type McpServerObject, normalizeMcp } from '@genpm/manifest';
import type { Client } from '../detect.js';

export type McpTarget = 'claude' | 'cursor' | 'vscode';

export const MCP_FILES: Record<McpTarget, string> = {
  claude: '.mcp.json',
  cursor: '.cursor/mcp.json',
  vscode: '.vscode/mcp.json',
};

/** Clientes detectados → archivos de config MCP de proyecto. Windsurf y Codex solo tienen config global. */
export function mcpTargets(clients: readonly Client[]): McpTarget[] {
  const out: McpTarget[] = [];
  if (clients.includes('claude')) out.push('claude');
  if (clients.includes('cursor')) out.push('cursor');
  if (clients.includes('copilot')) out.push('vscode');
  // Sin cliente con config de proyecto detectado: `.mcp.json` es el formato más extendido.
  if (out.length === 0) out.push('claude');
  return out;
}

function envRef(target: McpTarget, name: string): string {
  return target === 'claude' ? `\${${name}}` : `\${env:${name}}`;
}

export function serverConfig(target: McpTarget, m: McpServerObject): Record<string, unknown> {
  const env = m.e?.length ? Object.fromEntries(m.e.map((e) => [e, envRef(target, e)])) : undefined;
  if (target === 'vscode') {
    return m.u
      ? { type: 'http', url: m.u, ...(env ? { headers: {} } : {}) }
      : { type: 'stdio', command: m.c, args: m.a ?? [], ...(env ? { env } : {}) };
  }
  return m.u ? { type: 'http', url: m.u } : { command: m.c, args: m.a ?? [], ...(env ? { env } : {}) };
}

export type McpMergeResult = {
  text: string;
  added: string[];
  skipped: Array<{ n: string; reason: 'exists_different' }>;
  changed: boolean;
};

function stable(v: unknown): string {
  return JSON.stringify(v, (_k, val) =>
    val && typeof val === 'object' && !Array.isArray(val) ? Object.fromEntries(Object.entries(val).sort()) : val,
  );
}

export function mergeMcpConfig(
  current: string | null,
  target: McpTarget,
  servers: readonly McpServerEntry[],
): McpMergeResult {
  let json: Record<string, unknown> = {};
  if (current?.trim()) {
    try {
      json = JSON.parse(current) as Record<string, unknown>;
    } catch {
      // Archivo del usuario con JSON inválido (p. ej. comentarios): no lo tocamos.
      return {
        text: current,
        added: [],
        skipped: servers.map((s) => ({ n: normalizeMcp(s).n, reason: 'exists_different' })),
        changed: false,
      };
    }
  }
  const key = target === 'vscode' ? 'servers' : 'mcpServers';
  const map = { ...((json[key] as Record<string, unknown> | undefined) ?? {}) };
  const added: string[] = [];
  const skipped: McpMergeResult['skipped'] = [];
  for (const s of servers) {
    const m = normalizeMcp(s);
    const cfg = serverConfig(target, m);
    if (map[m.n] !== undefined) {
      if (stable(map[m.n]) !== stable(cfg)) skipped.push({ n: m.n, reason: 'exists_different' });
      continue;
    }
    map[m.n] = cfg;
    added.push(m.n);
  }
  if (!added.length) return { text: current ?? '', added, skipped, changed: false };
  json[key] = map;
  return { text: `${JSON.stringify(json, null, 2)}\n`, added, skipped, changed: true };
}

export function removeFromMcpConfig(
  current: string | null,
  target: McpTarget,
  names: readonly string[],
): { text: string; removed: string[] } {
  if (!current?.trim()) return { text: current ?? '', removed: [] };
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(current) as Record<string, unknown>;
  } catch {
    return { text: current, removed: [] };
  }
  const key = target === 'vscode' ? 'servers' : 'mcpServers';
  const map = { ...((json[key] as Record<string, unknown> | undefined) ?? {}) };
  const removed = names.filter((n) => n in map);
  for (const n of removed) delete map[n];
  json[key] = map;
  return { text: removed.length ? `${JSON.stringify(json, null, 2)}\n` : current, removed };
}

/** Comando completo legible, para mostrarlo antes de pedir consentimiento. */
export function commandLine(m: McpServerObject): string {
  return m.u ?? [m.c, ...(m.a ?? [])].join(' ');
}
