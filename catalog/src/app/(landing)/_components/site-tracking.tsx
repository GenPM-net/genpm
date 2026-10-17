// Banner de cookies y píxeles con consentimiento, para el layout raíz:
//   import { SiteTracking } from './(landing)/_components/site-tracking';  …  <body>{children}<SiteTracking /></body>
// Los ids de las plataformas son públicos (no los tokens de servidor) y vienen del entorno. Fuera de /admin (SiteChrome):
// el panel no muestra el banner ni carga píxeles, así no se mide al equipo.
import { policyVersion } from '@/lib/consent';
import { ConsentBanner, ConsentGate } from '@/lib/consent/react';
import { PixelScripts } from '@/lib/pixels/client';
import { SiteChrome } from '@/app/(cms)/_components/site-chrome';

export function SiteTracking({ policyHref = '/cookies' }: { policyHref?: string }) {
  const ga4 = process.env.GA4_MEASUREMENT_ID;
  const meta = process.env.META_PIXEL_ID;
  const tiktok = process.env.TIKTOK_PIXEL_ID;
  const version = policyVersion();
  return (
    <SiteChrome>
      <ConsentBanner policyVersion={version} policyHref={policyHref} />
      {ga4 && (
        <ConsentGate category="analytics" policyVersion={version}>
          <PixelScripts ga4MeasurementId={ga4} />
        </ConsentGate>
      )}
      {(meta || tiktok) && (
        <ConsentGate category="marketing" policyVersion={version}>
          <PixelScripts {...(meta && { metaPixelId: meta })} {...(tiktok && { tiktokPixelId: tiktok })} />
        </ConsentGate>
      )}
    </SiteChrome>
  );
}
