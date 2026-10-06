// POST /api/consent {analytics, marketing, preferences, action?} → guarda y fija la cookie. GET → estado actual.
import { z } from 'zod';
import { ChoicesInput, getConsent, recordConsent } from '../index.ts';

const Body = ChoicesInput.extend({ action: z.enum(['banner', 'preferences', 'withdraw']).default('banner') });

export async function handleConsent(req: Request, opts: { cookiesByCategory?: Partial<Record<'analytics' | 'marketing' | 'preferences', string[]>> } = {}): Promise<Response> {
  if (req.method === 'GET') return Response.json(getConsent(req.headers.get('cookie')), { headers: { 'cache-control': 'private, no-store' } });
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: 'invalid' }, { status: 400 });
  const { action, ...choices } = body.data;
  const { state, setCookies } = await recordConsent({ choices, action, cookieHeader: req.headers.get('cookie') }, { cookiesByCategory: opts.cookiesByCategory, secure: new URL(req.url).protocol === 'https:' });
  const headers = new Headers({ 'cache-control': 'no-store', 'content-type': 'application/json' });
  for (const c of setCookies) headers.append('set-cookie', c);
  return new Response(JSON.stringify(state), { headers });
}
