// Respuesta HTTP común a los adaptadores.
import { type SubmitResult, submitForm } from '../index.ts';

const STATUS: Record<Exclude<SubmitResult, { ok: true }>['reason'], number> = {
  not_found: 404,
  spam: 400,
  rate_limited: 429,
  consent_required: 400,
  invalid: 422,
};

/** Página de origen del mismo sitio (para volver tras un envío sin JavaScript), o null. */
function sameOriginReferer(req: Request): URL | null {
  const ref = req.headers.get('referer');
  if (!ref) return null;
  try {
    const u = new URL(ref);
    return u.host === new URL(req.url).host ? u : null;
  } catch {
    return null;
  }
}

export async function handleFormPost(req: Request, formKey: string): Promise<Response> {
  const type = req.headers.get('content-type') ?? '';
  const isJson = type.includes('application/json');
  const input = isJson ? ((await req.json().catch(() => ({}))) as Record<string, unknown>) : await req.formData();
  const result = await submitForm(formKey, input, { headers: req.headers, sourceUrl: req.headers.get('referer') });
  // Envío HTML clásico (sin JavaScript): volver a la página con el resultado en la URL (`<Form status>` lo muestra).
  const back = !isJson && (req.headers.get('accept') ?? '').includes('text/html') ? sameOriginReferer(req) : null;
  if (back) {
    back.searchParams.set('form', formKey);
    back.searchParams.set('form_status', result.ok ? 'sent' : result.reason);
    back.searchParams.delete('form_errors');
    if (!result.ok && result.reason === 'invalid') back.searchParams.set('form_errors', [...new Set(result.errors.map((e) => e.field))].join(','));
    back.hash = `form-${formKey}`;
    return new Response(null, { status: 303, headers: { location: back.toString() } });
  }
  if (result.ok) return Response.json(result, { status: 201 });
  const headers: Record<string, string> = result.reason === 'rate_limited' ? { 'retry-after': String(result.retryAfterSeconds ?? 60) } : {};
  return Response.json(result, { status: STATUS[result.reason], headers });
}
