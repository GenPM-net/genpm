// IDs ULID con prefijo (api-spec §1): ordenables por tiempo y globales entre bases de datos (ADR-011).

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function ulid(now = Date.now()): string {
  let time = '';
  let t = now;
  for (let i = 0; i < 10; i++) {
    time = ALPHABET[t % 32] + time;
    t = Math.floor(t / 32);
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let rand = '';
  for (const b of bytes) rand += ALPHABET[b % 32];
  return time + rand;
}

export type IdPrefix =
  | 'acc'
  | 'reg'
  | 'scp'
  | 'pkg'
  | 'ver'
  | 'tok'
  | 'spn'
  | 'aud'
  | 'rep'
  | 'adv'
  | 'ses'
  | 'lead'
  | 'tp';

export function newId(prefix: IdPrefix, now?: number): string {
  return `${prefix}_${ulid(now)}`;
}
