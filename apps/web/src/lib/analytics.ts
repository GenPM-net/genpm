// Analítica propia y solo en el servidor (art. 22.2 LSSI-CE, EDPB 2/2023): se cuentan peticiones que el visitante ya
// hace (ver una página, buscar, abrir un paquete). El navegador no envía nada para esto, no se usan cookies ni
// almacenamiento y no se guarda la IP ni ningún identificador. Columnas del dataset `genpm_web_events`:
//   blob1 evento · blob2 detalle (ruta, paquete o búsqueda) · blob3 idioma · blob4 plantilla de ruta
//   blob5 quién (`bot` | `human` | `member` = con sesión) · blob6 dominio de procedencia · blob7 país · blob8 campaña
//   double1 nº de resultados (solo `search`). En `sponsored_*` el detalle es el id de campaña.
// La analítica con mapas de calor y grabaciones (PostHog) va aparte y solo con consentimiento (lib/consent.ts).
import { env } from 'cloudflare:workers';
import { campaign, refHost, routeOf, uaClass } from './ua.js';

export type WebEvent = 'page_view' | 'search' | 'pkg_view' | 'sponsored_impression' | 'sponsored_click';

export function recordEvent(
  event: WebEvent,
  detail: string,
  ctx: { request: Request; locale: string; path: string; member?: boolean; results?: number },
): void {
  try {
    const url = new URL(ctx.request.url);
    const h = ctx.request.headers;
    const who = ctx.member ? 'member' : uaClass(h.get('user-agent'));
    const country = (ctx.request as Request & { cf?: { country?: string } }).cf?.country ?? '';
    env.EVENTS?.writeDataPoint({
      blobs: [
        event,
        detail.slice(0, 120),
        ctx.locale,
        routeOf(ctx.path),
        who,
        refHost(h.get('referer')),
        country,
        campaign(url),
      ],
      doubles: [ctx.results ?? 0],
      indexes: [event],
    });
  } catch {
    // la analítica nunca rompe la página
  }
}
