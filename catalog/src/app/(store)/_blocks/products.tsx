// Bloques de tienda para páginas y landings: "Grid de productos" y "Comprar ahora" (registrados en src/genpm/blocks.ts).
import { z } from 'zod';
import { defineBlock, Section } from '@/lib/blocks';
import { getProduct, listProducts } from '@/lib/catalog';
import { imageFor } from '@/lib/media';
import { AddToCart } from '../_components/add-to-cart';
import { ProductCard } from '../_components/product-card';
import { price, productPath } from '../_lib/store';

export const productGrid = defineBlock({
  type: 'product-grid',
  label: 'Product grid',
  icon: 'grid',
  schema: z.object({
    title: z.string().trim().max(160).optional(),
    category: z.string().max(80).optional().transform((v) => v || undefined),
    collection: z.string().max(80).optional().transform((v) => v || undefined),
    count: z.coerce.number().int().min(1).max(24).default(8),
  }),
  fields: [
    { name: 'title', label: 'Title', type: 'text' },
    { name: 'category', label: 'Category', type: 'relation', relationTo: 'product-categories', relationKey: 'slug' },
    { name: 'collection', label: 'Collection slug', type: 'text' },
    { name: 'count', label: 'Number of products', type: 'number' },
  ],
  defaults: () => ({ title: 'Featured products', count: 8 }),
  Component: async ({ data, ctx }) => {
    const { products } = await listProducts({ perPage: data.count, ...(data.category && { category: data.category }), ...(data.collection && { collection: data.collection }) });
    if (!products.length) return null;
    return (
      <Section id={ctx.id} block="product-grid" title={data.title} ctx={ctx} label="Products">
        <ul className="blk-grid blk-grid--4" role="list">
          {products.map((p) => (
            <li key={p.id}>
              <ProductCard product={p} level={data.title ? ctx.level + 1 : ctx.level} />
            </li>
          ))}
        </ul>
      </Section>
    );
  },
});

export const buyNow = defineBlock({
  type: 'buy-now',
  label: 'Buy now',
  icon: 'cart',
  schema: z.object({ product: z.string().min(1).max(200), title: z.string().trim().max(160).optional() }),
  fields: [
    { name: 'product', label: 'Product slug', type: 'text', required: true },
    { name: 'title', label: 'Title (defaults to the product name)', type: 'text' },
  ],
  defaults: () => ({ product: '' }),
  Component: async ({ data, ctx }) => {
    const p = await getProduct(data.product);
    if (!p) return null;
    const img = await imageFor(p.media[0], { sizes: '(min-width: 768px) 40vw, 100vw' });
    return (
      <Section id={ctx.id} block="buy-now" title={data.title ?? p.name} ctx={ctx}>
        <div className="blk-split">
          {img && <img {...img} alt={img.alt || p.name} loading="lazy" decoding="async" />}
          <div>
            {p.priceRange && <p className="store-price store-price--big">{price(p.priceRange.min)}</p>}
            <AddToCart product={p} />
            <p>
              <a href={productPath(p)}>Product details</a>
            </p>
          </div>
        </div>
      </Section>
    );
  },
});
