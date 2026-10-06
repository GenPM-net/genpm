// Handlers comunes: GET lista aprobada, POST nuevo comentario (form-data o JSON).
import { CommentError, listComments, type Moderation, postComment } from '../index.js';

export type CurrentUser = (req: Request) => Promise<{ id: string; name: string | null } | null>;

const STATUS = { spam: 400, rate_limited: 429, invalid: 422, banned: 403, not_found: 404, forbidden: 403 } as const;

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
    return Response.json({ id: c.id, status: c.status }, { status: 201 });
  } catch (e) {
    if (e instanceof CommentError) return Response.json({ error: e.code }, { status: STATUS[e.code] });
    throw e;
  }
}
