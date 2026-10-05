// Analítica propia y solo en el servidor (art. 22.2 LSSI-CE, EDPB 2/2023): se cuentan peticiones que el visitante ya
// hace (buscar, abrir un paquete). El navegador no envía nada, no se usan cookies ni almacenamiento y no se guarda la
// IP ni ningún identificador: solo el evento, el paquete o la búsqueda normalizada, el idioma, la ruta y si el
// user-agent es de un robot (blob5 = `bot` | `human`), porque buscadores y crawlers de IA renderizan cada paquete.
import { env } from 'cloudflare:workers';
import { uaClass } from './ua.js';

export function recordEvent(
  event: 'search' | 'pkg_view',
  detail: string,
  locale: string,
  path: string,
  ua?: string | null,
): void {
  try {
    env.EVENTS?.writeDataPoint({
      blobs: [event, detail.slice(0, 120), locale, path.slice(0, 200), uaClass(ua)],
      indexes: [event],
    });
  } catch {
    // la analítica nunca rompe la página
  }
}
