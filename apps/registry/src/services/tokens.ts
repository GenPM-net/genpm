// Tokens `gpm_` (api-spec §4.8): 32 bytes aleatorios en base62 + checksum CRC32 (6 caracteres base62).
// En reposo solo se guarda HMAC-SHA256(TOKEN_PEPPER, token); comparación por igualdad de hash (tiempo constante en D1).

const B62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function base62(bytes: Uint8Array): string {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let out = '';
  while (n > 0n) {
    out = B62[Number(n % 62n)] + out;
    n /= 62n;
  }
  return out;
}

function base62Fixed(n: number, width: number): string {
  let out = '';
  let v = n >>> 0;
  while (v > 0) {
    out = B62[v % 62] + out;
    v = Math.floor(v / 62);
  }
  return out.padStart(width, '0');
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

export function crc32(s: string): number {
  let c = 0xffffffff;
  for (const b of new TextEncoder().encode(s)) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function newToken(): string {
  const body = base62(crypto.getRandomValues(new Uint8Array(32))).padStart(43, '0');
  return `gpm_${body}${base62Fixed(crc32(body), 6)}`;
}

/** Comprobación local del formato y del checksum (lo que hacen los escáneres de secretos sin consultar el API). */
export function isWellFormedToken(token: string): boolean {
  const m = token.match(/^gpm_([0-9A-Za-z]{43})([0-9A-Za-z]{6})$/);
  return !!m && base62Fixed(crc32(m[1]!), 6) === m[2];
}

export async function hashToken(pepper: string, token: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pepper),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(token));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Hash de IP con sal diaria (security §5: la IP nunca se guarda en claro). */
export async function hashIp(salt: string, ip: string, day = new Date().toISOString().slice(0, 10)): Promise<string> {
  return (await hashToken(`${salt}:${day}`, ip)).slice(0, 32);
}
