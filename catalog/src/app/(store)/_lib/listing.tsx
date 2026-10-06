// Listados de categoría y colección: mismo grid con distinto filtro.
import { eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { categories, collections, listProducts } from '@/lib/catalog';
import { getDb } from '@/lib/db';
import { buildMetadata } from '@/lib/seo';
import { ProductGrid } from '../_components/product-grid';
import { pageParam } from './store';

type Kind = 'category' | 'collection';
export type ListingProps = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

async function load(kind: Kind, slug: string) {
  const table = kind === 'category' ? categories : collections;
  const [row] = await getDb().select({ name: table.name, description: table.description }).from(table).where(eq(table.slug, slug));
  return row ?? null;
}

export function listing(kind: Kind) {
  const base = kind === 'category' ? '/categories' : '/collections';
  return {
    async generateMetadata({ params }: ListingProps): Promise<Metadata> {
      const { slug } = await params;
      const t = await load(kind, slug);
      return t ? ((await buildMetadata({ title: t.name, path: `${base}/${slug}`, ...(t.description && { description: t.description.slice(0, 160) }) })) as Metadata) : {};
    },
    async Page({ params, searchParams }: ListingProps) {
      const { slug } = await params;
      const t = await load(kind, slug);
      if (!t) notFound();
      const page = pageParam(await searchParams);
      const { products, pages } = await listProducts({ [kind]: slug, page, perPage: 24 });
      return <ProductGrid title={t.name} intro={t.description ? <p>{t.description}</p> : undefined} products={products} page={page} pages={pages} basePath={`${base}/${slug}`} />;
    },
  };
}
