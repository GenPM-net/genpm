// Fuentes de sitemap y buscador a partir de una colección (para registrar en src/genpm/seo.ts y search.ts).
import { and, asc, eq, gt } from 'drizzle-orm';
import { defineSearchSource, defineSitemapSource, type SearchSource, type SitemapSource } from '../contracts/index.ts';
import { getDb } from '../db/index.ts';
import { getCollection } from './registry.ts';
import { type ContentRow, contentEntries } from './schema.ts';

type PathFn = (entry: { slug: string; locale: string; data: Record<string, unknown> }) => string;

async function* published(collection: string): AsyncGenerator<ContentRow> {
  let after = '';
  for (;;) {
    const rows = await getDb()
      .select()
      .from(contentEntries)
      .where(and(eq(contentEntries.collection, collection), eq(contentEntries.status, 'published'), gt(contentEntries.id, after)))
      .orderBy(asc(contentEntries.id))
      .limit(500);
    yield* rows;
    if (rows.length < 500) return;
    after = rows.at(-1)!.id;
  }
}

/** URLs publicadas de una colección, con `hreflang` entre traducciones. */
export function contentSitemapSource(collection: string, path: PathFn): SitemapSource {
  getCollection(collection);
  return defineSitemapSource({
    name: collection,
    async *urls() {
      const rows: ContentRow[] = [];
      for await (const r of published(collection)) rows.push(r);
      const groups = new Map<string, ContentRow[]>();
      for (const r of rows) groups.set(r.groupId, [...(groups.get(r.groupId) ?? []), r]);
      for (const r of rows) {
        const siblings = groups.get(r.groupId)!;
        const loc = path({ slug: r.slug, locale: r.locale, data: r.data ?? {} });
        yield {
          loc,
          lastmod: r.updatedAt,
          ...(siblings.length > 1 && {
            alternates: Object.fromEntries(siblings.map((s) => [s.locale, path({ slug: s.slug, locale: s.locale, data: s.data ?? {} })])),
          }),
        };
      }
    },
  });
}

/** Documentos publicados de una colección para @core/search. `text` extrae el texto plano (p. ej. con rich-text). */
export function contentSearchSource(
  collection: string,
  opts: { type?: string; path: PathFn; title?: (data: Record<string, unknown>) => string; text?: (data: Record<string, unknown>) => string },
): SearchSource {
  const c = getCollection(collection);
  const title = opts.title ?? ((d) => String(d[c.titleField ?? 'title'] ?? ''));
  const text =
    opts.text ??
    ((d) =>
      Object.values(d)
        .filter((v): v is string => typeof v === 'string')
        .join('\n'));
  return defineSearchSource({
    type: opts.type ?? collection,
    async *documents() {
      for await (const r of published(collection)) {
        const data = r.data ?? {};
        yield { id: r.id, type: opts.type ?? collection, url: opts.path({ slug: r.slug, locale: r.locale, data }), title: title(data), body: text(data), locale: r.locale, updatedAt: r.updatedAt };
      }
    },
  });
}
