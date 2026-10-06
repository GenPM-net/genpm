// Adaptador Next.js para la vista previa de borradores, sin importar `next`:
//   app/api/preview/route.ts:
//     import { draftMode } from 'next/headers';
//     import { previewRoute } from '@/lib/content/adapters/next';
//     export const GET = previewRoute(draftMode);
//   app/api/exit-preview/route.ts: `export const GET = exitPreviewRoute(draftMode);`
//   En la página: `const { isEnabled } = await draftMode(); await getEntry('pages', slug, { draft: isEnabled })`.
import { ContentError, verifyPreviewToken } from '../index.js';

type DraftMode = () => Promise<{ enable(): void; disable(): void }> | { enable(): void; disable(): void };

/** GET `/api/preview?token=…` → activa el modo borrador y redirige a la ruta firmada en el token. */
export function previewRoute(draftMode: DraftMode) {
  return async (req: Request): Promise<Response> => {
    try {
      const claims = await verifyPreviewToken(new URL(req.url).searchParams.get('token'));
      (await draftMode()).enable();
      return new Response(null, { status: 307, headers: { location: claims.path, 'cache-control': 'no-store' } });
    } catch (e) {
      if (e instanceof ContentError) return Response.json({ error: 'invalid_token' }, { status: 401 });
      throw e;
    }
  };
}

/** GET `/api/exit-preview?path=/x` → desactiva el modo borrador. */
export function exitPreviewRoute(draftMode: DraftMode) {
  return async (req: Request): Promise<Response> => {
    (await draftMode()).disable();
    const path = new URL(req.url).searchParams.get('path') ?? '/';
    const location = /^\/(?![/\\])/.test(path) ? path : '/';
    return new Response(null, { status: 307, headers: { location } });
  };
}
