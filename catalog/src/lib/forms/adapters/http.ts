// Respuesta HTTP común a los adaptadores.
import { type SubmitResult, submitForm } from '../index.js';

const STATUS: Record<Exclude<SubmitResult, { ok: true }>['reason'], number> = {
  not_found: 404,
  spam: 400,
  rate_limited: 429,
  consent_required: 400,
  invalid: 422,
};

export async function handleFormPost(req: Request, formKey: string): Promise<Response> {
  const type = req.headers.get('content-type') ?? '';
  const input = type.includes('application/json') ? ((await req.json().catch(() => ({}))) as Record<string, unknown>) : await req.formData();
  const result = await submitForm(formKey, input, { headers: req.headers, sourceUrl: req.headers.get('referer') });
  if (result.ok) return Response.json(result, { status: 201 });
  const headers: Record<string, string> = result.reason === 'rate_limited' ? { 'retry-after': String(result.retryAfterSeconds ?? 60) } : {};
  return Response.json(result, { status: STATUS[result.reason], headers });
}
