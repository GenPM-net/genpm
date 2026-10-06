// Conversión de leads: el formulario de la landing se envía aquí; se guarda con @core/forms, se programa el evento
// de servidor (Meta CAPI, TikTok Events, GA4 MP, solo con consentimiento) y la página de gracias lanza el mismo
// evento en el navegador con el mismo `eventId`, para que las plataformas lo cuenten una vez.
import { z } from 'zod';
import { submitForm } from '@/lib/forms';
import { defineJob } from '@/lib/jobs';
import { attributionFromRequest, saveAttribution, takeAttribution, trackServer } from '@/lib/pixels';
import { LANDING_PREFIX } from './landings';

export const leadEventId = (submissionId: string) => `lead_${submissionId}`;

export const leadEventJob = defineJob(
  'landing.lead-event',
  z.object({ eventId: z.string().max(80), formKey: z.string().max(64) }),
  async ({ eventId, formKey }) => {
    const a = await takeAttribution(eventId);
    if (!a) return;
    await trackServer({ type: 'lead', eventId, formKey }, a);
  },
  { maxAttempts: 3 },
);

/** POST /lp/<slug>/lead/<formKey>: guarda el envío y vuelve a la landing (error) o a su página de gracias (éxito). */
export async function handleLandingLead(req: Request, slug: string, formKey: string): Promise<Response> {
  const page = new URL(`${LANDING_PREFIX}/${encodeURIComponent(slug)}`, req.url);
  // La URL de origen (con sus UTM) la da el Referer si es del mismo sitio; si no, la propia landing.
  const ref = req.headers.get('referer');
  const source = ref && new URL(ref, req.url).host === page.host ? ref : page.toString();
  const result = await submitForm(formKey, await req.formData(), { headers: req.headers, sourceUrl: source });
  if (!result.ok) {
    const back = new URL(source);
    back.searchParams.set('form', formKey);
    back.searchParams.set('form_status', result.reason);
    if (result.reason === 'invalid') back.searchParams.set('form_errors', [...new Set(result.errors.map((e) => e.field))].join(','));
    back.hash = `form-${formKey}`;
    return new Response(null, { status: 303, headers: { location: back.toString() } });
  }
  const eventId = leadEventId(result.id);
  const attribution = attributionFromRequest(new Request(source, { headers: req.headers }));
  if (attribution.consent.analytics || attribution.consent.marketing) {
    await saveAttribution(eventId, attribution);
    await leadEventJob.enqueue({ eventId, formKey }, { dedupeKey: eventId });
  }
  const thanks = new URL(`${page.pathname}/thanks`, page);
  thanks.searchParams.set('e', eventId);
  thanks.searchParams.set('f', formKey);
  return new Response(null, { status: 303, headers: { location: thanks.toString() } });
}
