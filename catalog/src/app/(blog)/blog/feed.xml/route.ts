import { rssFeed } from '@/lib/blog';
import { getSiteSettings } from '@/lib/site';
import '../../_lib/blog';

export const dynamic = 'force-dynamic'; // se genera en cada petición (con caché HTTP): el build no necesita BD ni SITE_URL

export async function GET(): Promise<Response> {
  const s = await getSiteSettings();
  const body = await rssFeed({ title: s?.name ?? 'Blog', ...(s?.tagline && { description: s.tagline }), blogPath: '/blog' });
  return new Response(body, { headers: { 'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': 'public, max-age=600' } });
}
