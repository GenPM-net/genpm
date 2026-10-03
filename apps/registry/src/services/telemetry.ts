// Eventos de instalación en Analytics Engine (architecture §11, INV-6): solo (paquete, versión, cliente,
// versión del CLI, país). `client=none` (GENPM_TELEMETRY=0 / DO_NOT_TRACK=1) ⇒ no se registra nada.
import type { Context } from 'hono';
import type { AppEnv } from '../env.js';

const CLIENTS = new Set(['cli', 'mcp', 'web']);

export async function recordInstall(c: Context<AppEnv>, name: string, version: string, client: string): Promise<void> {
  if (!CLIENTS.has(client) || !c.env.INSTALLS) return;
  const ua = c.req.header('user-agent') ?? '';
  const cliVersion = ua.match(/genpm\/(\d+\.\d+\.\d+[^\s]*)/)?.[1] ?? '';
  const country = (c.req.raw as Request & { cf?: { country?: string } }).cf?.country ?? '';
  c.env.INSTALLS.writeDataPoint({
    blobs: [name, version, client, cliVersion, country, c.get('tenant').registryId],
    doubles: [1],
    indexes: [name],
  });
}
