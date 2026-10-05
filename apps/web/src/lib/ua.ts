// Clasificación robot/persona para la analítica propia (lib/analytics.ts). No guarda el user-agent.

const BOT =
  /bot|crawl|spider|slurp|archiver|facebookexternalhit|embedly|preview|headless|lighthouse|pagespeed|monitor|uptime|curl|wget|python|httpx|go-http|node-fetch|undici|axios|java\/|okhttp|scrapy|gpt|claude|anthropic|perplexity|bytespider|ahrefs|semrush|mj12|dataforseo/i;

/** `bot` si el user-agent falta o parece automático. Solo clasifica: el user-agent no se guarda. */
export function uaClass(ua: string | null | undefined): 'bot' | 'human' {
  return !ua || BOT.test(ua) ? 'bot' : 'human';
}
