// Landing: bloques con formularios que envían a /lp/<slug>/lead/<form> (conversión + página de gracias).
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { blocks } from '@/genpm';
import { RenderBlocks } from '@/lib/blocks';
import { loadBlockMedia } from '@/lib/blocks/media';
import { CONSENT_COOKIE, hasConsent } from '@/lib/consent';
import { getVariant } from '@/lib/experiments';
import { Form } from '@/lib/forms';
import { buildMetadata } from '@/lib/seo';
import { landingPath } from '../../_lib/landings';
import { loadLanding } from '../../_lib/load';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const l = await loadLanding((await params).slug);
  if (!l) return {};
  return (await buildMetadata({
    title: l.data.seo?.title ?? l.data.title,
    path: landingPath(l),
    ...(l.data.seo?.description && { description: l.data.seo.description }),
    ...(l.data.seo?.image && { image: l.data.seo.image }),
    ...((l.data.seo?.noindex || l.status !== 'published') && { noindex: true }),
  })) as Metadata;
}

export default async function Landing({ params, searchParams }: Props) {
  const { slug } = await params;
  const l = await loadLanding(slug);
  if (!l) notFound();
  const sp = await searchParams;
  const consent = (await cookies()).get(CONSENT_COOKIE)?.value;
  const cookieHeader = consent ? `${CONSENT_COOKIE}=${consent}` : null;
  const marketing = cookieHeader ? hasConsent(cookieHeader, 'marketing') : false;
  // Test A/B: la variante `b` usa `blocksB` (solo con consentimiento de analítica; si no, siempre el control).
  const variant = l.data.experiment && l.data.blocksB.length ? (await getVariant(l.data.experiment, cookieHeader)).variant : 'a';
  const shown = variant === 'b' ? l.data.blocksB : l.data.blocks;
  const media = await loadBlockMedia(shown, blocks);
  return (
    <main className={`landing landing--${l.data.layout}`} data-layout={l.data.layout} data-variant={variant}>
      {/* Diseño mínimo: oculta la cabecera y el pie del sitio marcados con .site-chrome en el layout raíz. */}
      {l.data.layout === 'minimal' && <style>{'.site-chrome{display:none}'}</style>}
      <RenderBlocks
        blocks={shown}
        registry={blocks}
        media={media}
        embeds={marketing ? 'iframe' : 'link'}
        renderForm={(key) => <Form formKey={key} searchParams={sp} action={`${landingPath(l)}/lead/${encodeURIComponent(key)}`} />}
      />
    </main>
  );
}
