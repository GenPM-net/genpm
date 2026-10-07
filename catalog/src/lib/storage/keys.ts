// Claves de objeto seguras: siempre las genera el servidor; nunca el nombre de archivo del usuario como ruta.

const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export class StorageError extends Error {
  constructor(
    readonly code: 'invalid_key' | 'too_large' | 'not_public' | 'invalid_token' | 'not_found' | 'upstream',
    message: string = code,
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

/** Valida una clave (`public/media/2026/abc.jpg`): segmentos seguros, sin `..`, sin barra inicial, ≤ 512. */
export function assertSafeKey(key: string): string {
  const segments = key.split('/');
  if (key.length > 512 || segments.length > 10 || !segments.every((s) => SEGMENT.test(s) && s !== '..' && !/^\.+$/.test(s)))
    throw new StorageError('invalid_key', `invalid storage key: ${JSON.stringify(key)}`);
  return key;
}

const EXT = /\.([A-Za-z0-9]{1,8})$/;

/** Clave nueva bajo `prefix` con id aleatorio y la extensión (saneada) del nombre original. */
export function generateKey(prefix: string, filename = ''): string {
  const ext = EXT.exec(filename)?.[1]?.toLowerCase();
  const id = crypto.randomUUID().replaceAll('-', '');
  return assertSafeKey(`${prefix.replace(/\/+$/, '')}/${id}${ext ? `.${ext}` : ''}`);
}

/** Solo lo que está bajo `public/` se sirve sin firmar. */
export const isPublicKey = (key: string) => key.startsWith('public/');
