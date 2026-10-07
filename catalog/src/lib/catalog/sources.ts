// Fuentes de sitemap y buscador con los productos activos.
import { and, asc, eq, gt } from 'drizzle-orm';
import { defineSearchSource, defineSitemapSource } from '../contracts/index.ts';
import { getDb } from '../db/index.ts';
import { toPlainText } from '../rich-text/index.ts';
import { type Product, products } from './schema.ts';

async function* active(): AsyncGenerator<Product> {
  let after = '';
  for (;;) {
    const rows = await getDb().select().from(products).where(and(eq(products.status, 'active'), gt(products.id, after))).orderBy(asc(products.id)).limit(500);
    yield* rows;
    if (rows.length < 500) return;
    after = rows.at(-1)!.id;
  }
}

const defaultPath = (slug: string) => `/products/${slug}`;

export const productSitemapSource = (path = defaultPath) =>
  defineSitemapSource({
    name: 'products',
    async *urls() {
      for await (const p of active()) yield { loc: path(p.slug), lastmod: p.updatedAt };
    },
  });

export const productSearchSource = (path = defaultPath) =>
  defineSearchSource({
    type: 'product',
    async *documents() {
      for await (const p of active())
        yield {
          id: p.id,
          type: 'product',
          url: path(p.slug),
          title: p.name,
          body: [p.brand, p.tags.join(' '), Object.values(p.attributes).join(' '), p.description ? toPlainText(p.description) : ''].filter(Boolean).join('\n'),
          updatedAt: p.updatedAt,
        };
    },
  });
