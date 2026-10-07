// Handlers comunes: GET lista aprobada, POST nuevo comentario (form-data o JSON).
import { CommentError, listComments, type Moderation, postComment } from '../index.ts';

export type CurrentUser = (req: Request) => Promise<{ id: string; name: string | null } | null>;

const STATUS = { spam: 400, rate_limited: 429, invalid: 422, banned: 403, not_found: 404, forbidden: 403 } as const;

/** Envío HTML clásico (sin JavaScript) desde una página del mismo sitio: URL a la que volver, o null. */
function backUrl(req: Request, isJson: boolean): URL | null {
  if (isJson || !(req.headers.get('accept') ?? '').includes('text/html')) return null;
  const ref = req.headers.get('referer');
  if (!ref) return null;
  try {
    const u = new URL(ref);
    return u.host === new URL(req.url).host ? u : null;
  } catch {
    return null;
  }
}

export async function handleList(req: Request, entityType: string, entityId: string): Promise<Response> {
  const page = Number(new URL(req.url).searchParams.get('page') ?? 1) || 1;
  return Response.json(await listComments(entityType, entityId, { page }), { headers: { 'cache-control': 'public, max-age=30' } });
}

export async function handlePost(req: Request, entityType: string, entityId: string, opts: { currentUser: CurrentUser; moderation?: Moderation }): Promise<Response> {
  const isJson = (req.headers.get('content-type') ?? '').includes('application/json');
  const fields: Record<string, unknown> = {};
  if (isJson) Object.assign(fields, await req.json().catch(() => ({})));
  else (await req.formData()).forEach((v, k) => typeof v === 'string' && (fields[k] = v));
  const user = await opts.currentUser(req);
  try {
    const c = await postComment(
      {
        entityType,
        entityId,
        body: String(fields.body ?? ''),
        ...(fields.parentId ? { parentId: String(fields.parentId) } : {}),
        ...(fields.rating ? { rating: Number(fields.rating) } : {}),
        user,
        ...(!user && { guest: { name: String(fields.name ?? ''), email: String(fields.email ?? '') } }),
      },
      { headers: req.headers, fields, moderation: opts.moderation },
    );
    const back = backUrl(req, isJson);
    if (back) return seeOther(back, c.status);
    return Response.json({ id: c.id, status: c.status }, { status: 201 });
  } catch (e) {
    if (e instanceof CommentError) {
      const back = backUrl(req, isJson);
      return back ? seeOther(back, e.code) : Response.json({ error: e.code }, { status: STATUS[e.code] });
    }
    throw e;
  }
}

/** Vuelve a la página con `?comment=<estado|error>#comments` (la plantilla muestra el aviso). */
function seeOther(back: URL, result: string): Response {
  back.searchParams.set('comment', result);
  back.hash = 'comments';
  return new Response(null, { status: 303, headers: { location: back.toString() } });
}
