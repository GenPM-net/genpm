// Adaptador Next.js para la vista previa de borradores, sin importar `next`:
//   app/api/preview/route.ts:
//     import { cookies, draftMode } from 'next/headers';
//     import { previewRoute } from '@/lib/content/adapters/next';
//     export const GET = previewRoute(draftMode, cookies);
//   app/api/exit-preview/route.ts: `export const GET = exitPreviewRoute(draftMode);`
//   En la página: `const { isEnabled } = await draftMode(); await getEntry('pages', slug, { draft: isEnabled })`.
// El modo borrador de Next es de todo el navegador: mientras dure, se ven los borradores de cualquier entrada. Por eso,
// con `cookies`, la cookie de Next se acorta para que caduque a la vez que el token (TTL del panel: 600 s).
import { ContentError, safePath, verifyPreviewToken } from '../index.ts';

type DraftMode = () => Promise<{ enable(): void; disable(): void }> | { enable(): void; disable(): void };

type CookieStore = {
  get(name: string): { value: string } | undefined;
  set(cookie: { name: string; value: string; httpOnly: boolean; sameSite: 'lax' | 'none'; secure: boolean; path: string; maxAge: number }): unknown;
};
type Cookies = () => Promise<CookieStore> | CookieStore;

/** Cookie con la que Next.js 15 activa el modo borrador (`COOKIE_NAME_PRERENDER_BYPASS`). */
export const DRAFT_MODE_COOKIE = '__prerender_bypass';

/**
 * Vuelve a escribir la cookie del modo borrador con los mismos atributos que pone Next (`draft-mode-provider.js`) y
 * `maxAge` hasta la caducidad del token; sin él sería una cookie de sesión sin fin.
 */
async function expireDraftModeWith(cookies: Cookies, exp: number): Promise<void> {
  const store = await cookies();
  const value = store.get(DRAFT_MODE_COOKIE)?.value;
  if (!value) return;
  const dev = process.env.NODE_ENV === 'development';
  store.set({
    name: DRAFT_MODE_COOKIE,
    value,
    httpOnly: true,
    sameSite: dev ? 'lax' : 'none',
    secure: !dev,
    path: '/',
    maxAge: Math.max(1, Math.floor((exp - Date.now()) / 1000)),
  });
}

/**
 * GET `/api/preview?token=…` → activa el modo borrador y redirige a la ruta firmada en el token. Con `cookies`
 * (recomendado) el modo borrador caduca con el token.
 */
export function previewRoute(draftMode: DraftMode, cookies?: Cookies) {
  return async (req: Request): Promise<Response> => {
    try {
      const claims = await verifyPreviewToken(new URL(req.url).searchParams.get('token'));
      (await draftMode()).enable();
      if (cookies) await expireDraftModeWith(cookies, claims.exp);
      return new Response(null, { status: 307, headers: { location: claims.path, 'cache-control': 'no-store' } });
    } catch (e) {
      if (e instanceof ContentError) return Response.json({ error: 'invalid_token' }, { status: 401 });
      throw e;
    }
  };
}

const safeOrRoot = (path: string) => {
  try {
    return safePath(path);
  } catch {
    return '/';
  }
};

/** GET `/api/exit-preview?path=/x` → desactiva el modo borrador y vuelve a `path` (solo rutas del propio sitio). */
export function exitPreviewRoute(draftMode: DraftMode) {
  return async (req: Request): Promise<Response> => {
    (await draftMode()).disable();
    const location = safeOrRoot(new URL(req.url).searchParams.get('path') ?? '/');
    return new Response(null, { status: 307, headers: { location, 'cache-control': 'no-store' } });
  };
}
