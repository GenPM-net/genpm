// Gracias: evento `lead` en el navegador (con consentimiento) con el eventId del envío.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ConsentGate } from '@/lib/consent/react';
import { TrackLead } from '../../../_components/track-lead';
import { loadLanding } from '../../../_lib/load';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
export const metadata: Metadata = { robots: { index: false, follow: false } };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function Thanks({ params, searchParams }: Props) {
  const l = await loadLanding((await params).slug);
  if (!l) notFound();
  const sp = await searchParams;
  const eventId = one(sp.e);
  const formKey = one(sp.f);
  const valid = eventId && /^lead_[A-Za-z0-9_]{6,64}$/.test(eventId);
  return (
    <main className={`landing landing--${l.data.layout} blk`}>
      {l.data.layout === 'minimal' && <style>{'.site-chrome{display:none}'}</style>}
      <h1>{l.data.thanksTitle}</h1>
      <p>{l.data.thanksText}</p>
      {valid && (
        <>
          <ConsentGate category="marketing">
            <TrackLead eventId={eventId} {...(formKey && /^[a-z][a-z0-9-]{0,47}$/.test(formKey) && { formKey })} />
          </ConsentGate>
          <ConsentGate category="analytics">
            <TrackLead eventId={eventId} {...(formKey && /^[a-z][a-z0-9-]{0,47}$/.test(formKey) && { formKey })} />
          </ConsentGate>
        </>
      )}
    </main>
  );
}
