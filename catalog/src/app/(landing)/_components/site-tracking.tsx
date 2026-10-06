// Banner de cookies y píxeles con consentimiento, para el layout raíz:
//   import { SiteTracking } from './(landing)/_components/site-tracking';  …  <body>{children}<SiteTracking /></body>
// Los ids de las plataformas son públicos (no los tokens de servidor) y vienen del entorno.
import { policyVersion } from '@/lib/consent';
import { ConsentBanner, ConsentGate } from '@/lib/consent/react';
import { PixelScripts } from '@/lib/pixels/client';

export function SiteTracking({ policyHref = '/cookies' }: { policyHref?: string }) {
  const ga4 = process.env.GA4_MEASUREMENT_ID;
  const meta = process.env.META_PIXEL_ID;
  const tiktok = process.env.TIKTOK_PIXEL_ID;
  return (
    <>
      <ConsentBanner policyVersion={policyVersion()} policyHref={policyHref} />
      {ga4 && (
        <ConsentGate category="analytics">
          <PixelScripts ga4MeasurementId={ga4} />
        </ConsentGate>
      )}
      {(meta || tiktok) && (
        <ConsentGate category="marketing">
          <PixelScripts {...(meta && { metaPixelId: meta })} {...(tiktok && { tiktokPixelId: tiktok })} />
        </ConsentGate>
      )}
    </>
  );
}
