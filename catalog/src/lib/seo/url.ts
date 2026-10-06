// URLs absolutas a partir de SITE_URL.

export function siteUrl(env: Record<string, string | undefined> = process.env): URL {
  const raw = env.SITE_URL;
  if (!raw) throw new Error('SITE_URL is not set (see .env.example)');
  const u = new URL(raw);
  if (u.protocol !== 'https:' && u.hostname !== 'localhost') throw new Error('SITE_URL must use https');
  return u;
}

/** `/blog/x` → `https://example.com/blog/x`; las URLs absolutas se devuelven tal cual. */
export function absoluteUrl(pathOrUrl: string, base: URL = siteUrl()): string {
  return /^https?:\/\//.test(pathOrUrl) ? pathOrUrl : new URL(pathOrUrl, base).toString();
}
