// ULID (https://github.com/ulid/spec): 48 bits de tiempo + 80 aleatorios en Crockford base32. Ordenable por fecha de
// creación, seguro en URLs y sin dependencias. Con prefijo opcional: `usr_01J…`.

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function ulid(now: number = Date.now()): string {
  let time = '';
  let t = now;
  for (let i = 0; i < 10; i++) {
    time = ALPHABET[t % 32] + time;
    t = Math.floor(t / 32);
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let rand = '';
  for (let i = 0; i < 16; i++) rand += ALPHABET[bytes[i]! % 32];
  return time + rand;
}

/** ID con prefijo legible del tipo de entidad: `newId('usr')` → `usr_01J9…`. */
export function newId(prefix?: string): string {
  return prefix ? `${prefix}_${ulid()}` : ulid();
}

/** Milisegundos desde epoch codificados en un ULID. */
export function ulidTime(id: string): number {
  const core = id.includes('_') ? id.slice(id.lastIndexOf('_') + 1) : id;
  let t = 0;
  for (const ch of core.slice(0, 10)) t = t * 32 + ALPHABET.indexOf(ch);
  return t;
}
