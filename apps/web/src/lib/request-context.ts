// Datos de la petición en curso accesibles desde cualquier helper (AsyncLocalStorage, nodejs_compat).
// Hoy solo la IP del visitante, que el registry necesita para limitar por persona y no por toda la web.
import { AsyncLocalStorage } from 'node:async_hooks';

const store = new AsyncLocalStorage<{ ip: string | null }>();

export function withRequest<T>(request: Request, fn: () => T): T {
  return store.run({ ip: request.headers.get('cf-connecting-ip') }, fn);
}

export function visitorIp(): string | null {
  return store.getStore()?.ip ?? null;
}
