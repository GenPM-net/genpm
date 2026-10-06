import { jsonFeed } from '@/lib/blog';
import { getSiteSettings } from '@/lib/site';
import '../../_lib/blog';

export const revalidate = 600;

export async function GET(): Promise<Response> {
  const s = await getSiteSettings();
  const body = await jsonFeed({ title: s?.name ?? 'Blog', ...(s?.tagline && { description: s.tagline }), blogPath: '/blog' });
  return new Response(body, { headers: { 'content-type': 'application/feed+json; charset=utf-8' } });
}
