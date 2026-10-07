// Proveedor configurado por variables de entorno: `getStorage()` en toda la app; `setStorage()` en tests.
import { backendStorage, diskBackend, memoryBackend } from './memory.ts';
import type { StorageProvider } from './provider.ts';
import { s3Storage } from './s3.ts';

function need(env: Record<string, string | undefined>, name: string): string {
  const v = env[name];
  if (!v) throw new Error(`${name} is not set (see .env.example)`);
  return v;
}

export function storageFromEnv(env: Record<string, string | undefined> = process.env): StorageProvider {
  const req = (name: string) => need(env, name);
  const driver = env.STORAGE_DRIVER ?? 's3';
  if (driver === 's3')
    return s3Storage({
      endpoint: req('STORAGE_ENDPOINT'),
      bucket: req('STORAGE_BUCKET'),
      region: env.STORAGE_REGION,
      accessKeyId: req('STORAGE_ACCESS_KEY_ID'),
      secretAccessKey: req('STORAGE_SECRET_ACCESS_KEY'),
      publicUrl: env.STORAGE_PUBLIC_URL,
    });
  if (driver !== 'local' && driver !== 'memory') throw new Error(`unknown STORAGE_DRIVER: ${driver}`);
  const local = { secret: req('STORAGE_SECRET'), baseUrl: req('STORAGE_PUBLIC_URL') };
  if (driver === 'local') return backendStorage('local', diskBackend(env.STORAGE_LOCAL_DIR ?? '.storage'), local);
  return backendStorage('memory', memoryBackend(), local);
}

let current: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  current ??= storageFromEnv();
  return current;
}

export function setStorage(s: StorageProvider): void {
  current = s;
}
