// Clasificación de la visita para la analítica propia (lib/analytics.ts). Funciones puras: no guardan el user-agent,
// la URL de referencia completa ni nada que identifique a la persona.

const BOT =
  /bot|crawl|spider|slurp|archiver|facebookexternalhit|embedly|preview|headless|lighthouse|pagespeed|monitor|uptime|curl|wget|python|httpx|go-http|node-fetch|undici|axios|java\/|okhttp|scrapy|gpt|claude|anthropic|perplexity|bytespider|ahrefs|semrush|mj12|dataforseo/i;

/** `bot` si el user-agent falta o parece automático. */
export function uaClass(ua: string | null | undefined): 'bot' | 'human' {
  return !ua || BOT.test(ua) ? 'bot' : 'human';
}

/** Dominio de procedencia (sin ruta ni query) o `''` si es interna o directa. */
export function refHost(referer: string | null | undefined, site = 'genpm.net'): string {
  if (!referer) return '';
  try {
    const host = new URL(referer).hostname.replace(/^www\./, '').toLowerCase();
    return host === site || host.endsWith(`.${site}`) ? '' : host.slice(0, 80);
  } catch {
    return '';
  }
}

/** Campaña declarada en la URL (`utm_source` o `ref`), normalizada. */
export function campaign(url: URL): string {
  const raw = url.searchParams.get('utm_source') ?? url.searchParams.get('ref') ?? '';
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 40);
}

/** Plantilla de la ruta: agrupa páginas de paquete y de scope para que el panel no se fragmente. */
export function routeOf(path: string): string {
  if (/^\/p\/@[^/]+\/[^/]+$/.test(path)) return '/p/*';
  if (/^\/@[^/]+$/.test(path)) return '/@*';
  return path.slice(0, 120) || '/';
}
