// Lector mínimo de tar.gz (ustar/pax/GNU long names), puro: lo usan el registry (escaneo en publish, una sola
// subpetición a codeload) y el cliente (fallback tarball). Solo lee; nunca escribe ni ejecuta nada.

export type TarEntry = {
  path: string;
  type: 'file' | 'dir' | 'symlink' | 'other';
  size: number;
  mode: number;
  content?: Uint8Array;
};

const decoder = new TextDecoder();

function str(buf: Uint8Array, off: number, len: number): string {
  const slice = buf.subarray(off, off + len);
  const nul = slice.indexOf(0);
  return decoder.decode(nul === -1 ? slice : slice.subarray(0, nul));
}

function octal(buf: Uint8Array, off: number, len: number): number {
  const s = str(buf, off, len).trim();
  return s ? Number.parseInt(s, 8) : 0;
}

function parsePax(data: Uint8Array): Record<string, string> {
  const out: Record<string, string> = {};
  let i = 0;
  while (i < data.length) {
    const sp = data.indexOf(32, i);
    if (sp === -1) break;
    const len = Number(decoder.decode(data.subarray(i, sp)));
    if (!len) break;
    const rec = decoder.decode(data.subarray(sp + 1, i + len - 1));
    const eq = rec.indexOf('=');
    if (eq > 0) out[rec.slice(0, eq)] = rec.slice(eq + 1);
    i += len;
  }
  return out;
}

export async function gunzip(stream: ReadableStream<Uint8Array>, maxBytes: number): Promise<Uint8Array> {
  const reader = (stream as unknown as ReadableStream<BufferSource>)
    .pipeThrough(new DecompressionStream('gzip'))
    .getReader() as ReadableStreamDefaultReader<Uint8Array>;
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel();
      throw new RangeError('archive too large');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

/** Recorre un tar en memoria. `keepContent(path,size)` decide si se conserva el contenido. */
export function readTar(buf: Uint8Array, keepContent: (path: string, size: number) => boolean): TarEntry[] {
  const out: TarEntry[] = [];
  let off = 0;
  let pax: Record<string, string> = {};
  let longName: string | null = null;
  while (off + 512 <= buf.length) {
    const header = buf.subarray(off, off + 512);
    if (header.every((b) => b === 0)) break;
    const name = str(header, 0, 100);
    const prefix = str(header, 345, 155);
    const size = octal(header, 124, 12);
    const mode = octal(header, 100, 8);
    const flag = String.fromCharCode(header[156] ?? 48);
    const dataStart = off + 512;
    const data = buf.subarray(dataStart, dataStart + size);
    off = dataStart + Math.ceil(size / 512) * 512;
    if (flag === 'x') {
      pax = parsePax(data);
      continue;
    }
    if (flag === 'g') continue;
    if (flag === 'L') {
      longName = str(data, 0, data.length);
      continue;
    }
    const path = pax['path'] ?? longName ?? (prefix ? `${prefix}/${name}` : name);
    pax = {};
    longName = null;
    const type =
      flag === '0' || flag === '\0' || flag === '7'
        ? 'file'
        : flag === '5'
          ? 'dir'
          : flag === '2'
            ? 'symlink'
            : 'other';
    const entry: TarEntry = { path, type, size, mode };
    if (type === 'file' && keepContent(path, size)) entry.content = data.slice();
    out.push(entry);
  }
  return out;
}

/** Cabecera pax global (`git archive` guarda ahí el SHA del commit como `comment`). */
export function tarGlobalComment(buf: Uint8Array): string | null {
  if (buf.length < 512) return null;
  const flag = String.fromCharCode(buf[156] ?? 0);
  if (flag !== 'g') return null;
  const size = octal(buf, 124, 12);
  return parsePax(buf.subarray(512, 512 + size))['comment'] ?? null;
}
