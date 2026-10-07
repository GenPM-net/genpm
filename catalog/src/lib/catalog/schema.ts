// Tablas de @core/catalog. Las recoge drizzle-kit vía src/lib/db/drizzle.config.ts.
import { boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from '../db/index.ts';
import type { Doc } from '../rich-text/index.ts';

export type ProductOption = { name: string; values: string[] };
export type ProductTranslation = { name?: string; description?: Doc; seoTitle?: string; seoDescription?: string };

export const products = pgTable(
  'products',
  {
    id: primaryId('prd'),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    description: jsonb('description').$type<Doc>(),
    status: text('status', { enum: ['draft', 'active', 'archived'] }).notNull().default('draft'),
    kind: text('kind', { enum: ['physical', 'digital'] }).notNull().default('physical'),
    brand: text('brand'),
    /** Opciones de variante en orden: `[{ name: 'Size', values: ['S','M'] }]`. */
    options: jsonb('options').$type<ProductOption[]>().notNull().default([]),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    /** Atributos libres para fichas y filtros (`material: ceramic`). */
    attributes: jsonb('attributes').$type<Record<string, string>>().notNull().default({}),
    translations: jsonb('translations').$type<Record<string, ProductTranslation>>().notNull().default({}),
    seoTitle: text('seo_title'),
    seoDescription: text('seo_description'),
    publishedAt: timestamp('published_at', { withTimezone: true, mode: 'date' }),
    ...timestamps,
  },
  (t) => [index('products_status_idx').on(t.status, t.publishedAt)],
);

export const productVariants = pgTable(
  'product_variants',
  {
    id: primaryId('var'),
    productId: text('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    sku: text('sku').unique(),
    /** `M / Red` (o vacío si el producto no tiene opciones). */
    title: text('title').notNull().default(''),
    options: jsonb('options').$type<Record<string, string>>().notNull().default({}),
    priceAmount: integer('price_amount').notNull(),
    /** Precio "antes" (tachado). Solo si es real: ver @core/discounts y @core/pricing (regla de 30 días UE). */
    compareAtAmount: integer('compare_at_amount'),
    /** Coste (para márgenes; nunca se muestra). */
    costAmount: integer('cost_amount'),
    currency: text('currency').notNull(),
    stock: integer('stock').notNull().default(0),
    trackStock: boolean('track_stock').notNull().default(true),
    /** Vender sin stock (bajo pedido). */
    allowBackorder: boolean('allow_backorder').notNull().default(false),
    lowStockThreshold: integer('low_stock_threshold').notNull().default(3),
    weightGrams: integer('weight_grams'),
    position: integer('position').notNull().default(0),
    active: boolean('active').notNull().default(true),
    /** Media de la variante (p. ej. foto del color). */
    mediaId: text('media_id'),
    ...timestamps,
  },
  (t) => [index('product_variants_product_idx').on(t.productId, t.position)],
);

export const productMedia = pgTable(
  'product_media',
  {
    productId: text('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    mediaId: text('media_id').notNull(),
    position: integer('position').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.productId, t.mediaId] })],
);

export const categories = pgTable('product_categories', {
  id: primaryId('cat'),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  parentId: text('parent_id'),
  position: integer('position').notNull().default(0),
  translations: jsonb('translations').$type<Record<string, { name?: string; description?: string }>>().notNull().default({}),
  ...timestamps,
});

export const productCategories = pgTable(
  'product_category_links',
  {
    productId: text('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    categoryId: text('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.productId, t.categoryId] }), index('product_category_links_cat_idx').on(t.categoryId)],
);

/** Colecciones manuales ordenadas (portada, "novedades", "más vendidos"…). */
export const collections = pgTable('product_collections', {
  id: primaryId('col'),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  ...timestamps,
});

export const collectionProducts = pgTable(
  'product_collection_items',
  {
    collectionId: text('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    productId: text('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.collectionId, t.productId] })],
);

export type Product = typeof products.$inferSelect;
export type Variant = typeof productVariants.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Collection = typeof collections.$inferSelect;
