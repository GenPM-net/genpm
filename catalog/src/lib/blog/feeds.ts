// Feeds RSS 2.0, Atom 1.0 y JSON Feed 1.1 con los últimos posts publicados (nunca borradores ni programados).
import { getEntry, listEntries } from '../content/index.ts';
import { type RenderOptions, toHtml } from '../rich-text/index.ts';
import type { AuthorData, PostData } from './collections.ts';
import { summarize } from './posts.ts';

export type FeedOptions = {
  /** Origen https del sitio (por defecto SITE_URL). */
  siteUrl?: string;
  title: string;
  description?: string;
  /** Ruta del blog y de cada post. */
  blogPath?: string;
  postPath?: (slug: string) => string;
  locale?: string;
  limit?: number;
  /** Incluir el contenido completo (si no, solo el extracto). Los posts `membersOnly` siempre van solo con extracto. */
  fullContent?: boolean;
  render?: RenderOptions;
};

const xml = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');

async function items(o: FeedOptions) {
  const base = new URL(o.siteUrl ?? process.env.SITE_URL ?? '');
  const path = o.postPath ?? ((s: string) => `${o.blogPath ?? '/blog'}/${s}`);
  const entries = await listEntries<PostData>('posts', { locale: o.locale, orderBy: '-publishedAt', limit: Math.min(o.limit ?? 20, 100) });
  const out = [];
  for (const e of entries) {
    const s = summarize(e);
    const names: string[] = [];
    for (const a of s.authors) names.push((await getEntry<AuthorData>('authors', a))?.data.name ?? a);
    out.push({
      ...s,
      url: new URL(path(s.slug), base).toString(),
      html: o.fullContent && !s.membersOnly ? toHtml(e.data.body, o.render) : `<p>${xml(s.excerpt)}</p>`,
      authorNames: names,
    });
  }
  return { base, items: out, home: new URL(o.blogPath ?? '/blog', base).toString() };
}

export async function rssFeed(o: FeedOptions): Promise<string> {
  const { items: list, home } = await items(o);
  const body = list
    .map(
      (i) =>
        `<item><title>${xml(i.title)}</title><link>${xml(i.url)}</link><guid isPermaLink="true">${xml(i.url)}</guid>${i.publishedAt ? `<pubDate>${i.publishedAt.toUTCString()}</pubDate>` : ''}<description>${xml(i.excerpt)}</description>${o.fullContent ? `<content:encoded>${xml(i.html)}</content:encoded>` : ''}${i.categories.map((c) => `<category>${xml(c)}</category>`).join('')}</item>`,
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${xml(o.title)}</title><link>${xml(home)}</link><description>${xml(o.description ?? o.title)}</description>${o.locale ? `<language>${xml(o.locale)}</language>` : ''}<atom:link href="${xml(`${home}/feed.xml`)}" rel="self" type="application/rss+xml"/>${body}</channel></rss>`;
}

export async function atomFeed(o: FeedOptions): Promise<string> {
  const { items: list, home } = await items(o);
  const updated = (list[0]?.updatedAt ?? new Date(0)).toISOString();
  const body = list
    .map(
      (i) =>
        `<entry><title>${xml(i.title)}</title><link href="${xml(i.url)}"/><id>${xml(i.url)}</id>${i.publishedAt ? `<published>${i.publishedAt.toISOString()}</published>` : ''}<updated>${i.updatedAt.toISOString()}</updated>${i.authorNames.map((n) => `<author><name>${xml(n)}</name></author>`).join('')}<summary>${xml(i.excerpt)}</summary>${o.fullContent ? `<content type="html">${xml(i.html)}</content>` : ''}</entry>`,
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom"${o.locale ? ` xml:lang="${xml(o.locale)}"` : ''}><title>${xml(o.title)}</title><link href="${xml(home)}"/><link rel="self" href="${xml(`${home}/atom.xml`)}"/><id>${xml(home)}</id><updated>${updated}</updated>${body}</feed>`;
}

export async function jsonFeed(o: FeedOptions): Promise<string> {
  const { items: list, home } = await items(o);
  return JSON.stringify({
    version: 'https://jsonfeed.org/version/1.1',
    title: o.title,
    home_page_url: home,
    feed_url: `${home}/feed.json`,
    ...(o.description && { description: o.description }),
    ...(o.locale && { language: o.locale }),
    items: list.map((i) => ({
      id: i.url,
      url: i.url,
      title: i.title,
      summary: i.excerpt,
      ...(o.fullContent ? { content_html: i.html } : {}),
      ...(i.publishedAt && { date_published: i.publishedAt.toISOString() }),
      date_modified: i.updatedAt.toISOString(),
      ...(i.authorNames.length && { authors: i.authorNames.map((name) => ({ name })) }),
      tags: i.tags,
    })),
  });
}
