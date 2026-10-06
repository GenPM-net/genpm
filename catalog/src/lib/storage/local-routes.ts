// Handlers de la ruta de almacenamiento local (drivers `local`/`memory`): subida firmada, descarga firmada y públicos.
import { assertSafeKey, isPublicKey, StorageError } from './keys.js';
import { verifyGrant } from './memory.js';
import type { StorageProvider } from './provider.js';

const err = (status: number, error: string) => Response.json({ error }, { status });

/** PUT `<ruta>?token=…` con el archivo en el cuerpo. */
export async function handleLocalUpload(req: Request, storage: StorageProvider, secret: string): Promise<Response> {
  try {
    const g = await verifyGrant(secret, new URL(req.url).searchParams.get('token'));
    if (g.op !== 'put') return err(403, 'invalid_token');
    if (req.headers.get('content-type') !== g.type) return err(400, 'content_type_mismatch');
    // Antes de leer el cuerpo: no aceptar más bytes de los firmados.
    if (Number(req.headers.get('content-length') ?? g.size) !== g.size) return err(400, 'size_mismatch');
    const bytes = new Uint8Array(await req.arrayBuffer());
    if (bytes.byteLength !== g.size) return err(400, 'size_mismatch');
    await storage.put(g.key, bytes, { contentType: g.type ?? 'application/octet-stream' });
    return new Response(null, { status: 200 });
  } catch (e) {
    if (e instanceof StorageError) return err(403, e.code);
    throw e;
  }
}

/** GET `<ruta>?token=…` (privados) o `<ruta>/public/…` (públicos). */
export async function handleLocalDownload(req: Request, storage: StorageProvider, secret: string, routePath = '/api/storage'): Promise<Response> {
  const url = new URL(req.url);
  let key: string;
  try {
    if (url.searchParams.has('token')) {
      const g = await verifyGrant(secret, url.searchParams.get('token'));
      if (g.op !== 'get') return err(403, 'invalid_token');
      key = g.key;
    } else {
      key = assertSafeKey(decodeURIComponent(url.pathname.slice(routePath.length + 1)));
      if (!isPublicKey(key)) return err(404, 'not_found');
    }
  } catch (e) {
    if (e instanceof StorageError) return err(e.code === 'invalid_key' ? 404 : 403, e.code);
    throw e;
  }
  const o = await storage.get(key);
  if (!o) return err(404, 'not_found');
  return new Response(o.body, {
    headers: {
      'content-type': o.contentType,
      'content-length': String(o.size),
      'x-content-type-options': 'nosniff',
      // Nunca se ejecuta como página del sitio (HTML/SVG subidos).
      'content-security-policy': "default-src 'none'; sandbox",
    },
  });
}
