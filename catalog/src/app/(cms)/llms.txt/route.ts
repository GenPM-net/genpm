// llms.txt (https://llmstxt.org): nombre, lema y páginas publicadas del sitio, para agentes.
import { pagePath } from '@/genpm';
import { listEntries } from '@/lib/content';
import { llmsTxt } from '@/lib/seo';
import { getSiteSettings } from '@/lib/site';

export const revalidate = 3600;

export async function GET(): Promise<Response> {
  const [settings, pages] = await Promise.all([getSiteSettings(), listEntries<{ title: string; seo?: { description?: string; noindex?: boolean } }>('pages', { limit: 200, orderBy: 'slug' })]);
  const body = llmsTxt({
    name: settings?.name ?? 'Site',
    ...(settings?.tagline && { summary: settings.tagline }),
    sections: [
      {
        title: 'Pages',
        links: pages
          .filter((p) => !p.data.seo?.noindex)
          .map((p) => ({ title: p.data.title, url: pagePath(p), ...(p.data.seo?.description && { note: p.data.seo.description }) })),
      },
    ],
  });
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
