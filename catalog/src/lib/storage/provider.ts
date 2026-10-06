// Interfaz común de los drivers (S3 compatible, local, memoria).

export type PutBody = Uint8Array | ArrayBuffer | string | Blob;

export type PutOptions = { contentType: string; cacheControl?: string };

export type StoredObject = { key: string; size: number; contentType: string; body: ReadableStream<Uint8Array> };

export type ObjectInfo = { key: string; size: number; contentType: string };

/** Subida directa desde el navegador: `fetch(url, { method, headers, body: file })`. */
export type PresignedUpload = { url: string; method: 'PUT'; headers: Record<string, string>; expiresAt: Date };

export type PresignUploadOptions = {
  contentType: string;
  /** Tamaño exacto declarado por el cliente; va firmado, así que no puede subir otra cosa. */
  size: number;
  /** Límite superior; si `size` lo supera se rechaza antes de firmar. */
  maxBytes: number;
  expiresIn?: number;
};

export interface StorageProvider {
  readonly driver: 's3' | 'local' | 'memory';
  put(key: string, body: PutBody, opts: PutOptions): Promise<ObjectInfo>;
  get(key: string): Promise<StoredObject | null>;
  head(key: string): Promise<ObjectInfo | null>;
  delete(key: string): Promise<void>;
  presignUpload(key: string, opts: PresignUploadOptions): Promise<PresignedUpload>;
  /** URL temporal de descarga para objetos privados. */
  presignDownload(key: string, expiresIn?: number): Promise<string>;
  /** URL pública estable; solo para claves bajo `public/`. */
  publicUrl(key: string): string;
}

export const toBytes = async (body: PutBody): Promise<Uint8Array> =>
  typeof body === 'string'
    ? new TextEncoder().encode(body)
    : body instanceof Uint8Array
      ? body
      : body instanceof ArrayBuffer
        ? new Uint8Array(body)
        : new Uint8Array(await body.arrayBuffer());

export const streamOf = (bytes: Uint8Array): ReadableStream<Uint8Array> =>
  new ReadableStream({
    start(c) {
      c.enqueue(bytes);
      c.close();
    },
  });
