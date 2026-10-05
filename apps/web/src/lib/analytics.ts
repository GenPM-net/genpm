// Analítica propia y solo en el servidor (art. 22.2 LSSI-CE, EDPB 2/2023): se cuentan peticiones que el visitante ya
// hace (buscar, abrir un paquete). El navegador no envía nada, no se usan cookies ni almacenamiento y no se guarda la
// IP ni ningún identificador: solo el evento, el paquete o la búsqueda normalizada, el idioma y la ruta.
import { env } from 'cloudflare:workers';

export function recordEvent(event: 'search' | 'pkg_view', detail: string, locale: string, path: string): void {
  try {
    env.EVENTS?.writeDataPoint({ blobs: [event, detail.slice(0, 120), locale, path.slice(0, 200)], indexes: [event] });
  } catch {
    // la analítica nunca rompe la página
  }
}
