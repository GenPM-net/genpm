// Productos: alta y edición con variantes, lectura pública (solo activos), listados con filtros y stock.
import { and, asc, count, desc, eq, gte, inArray, lte, ne, type SQL, sql } from 'drizzle-orm';
import { z } from 'zod';
import { type Executor, getDb, withTransaction } from '../db/index.ts';
import { type Money, money } from '../money/index.ts';
import { RichTextSchema } from '../rich-text/index.ts';
import {
  categories,
  collectionProducts,
  collections,
  type Product,
  productCategories,
  productMedia,
  products,
  productVariants,
  type Variant,
} from './schema.ts';

export class CatalogError extends Error {
  constructor(
    readonly code: 'not_found' | 'invalid' | 'out_of_stock' | 'slug_taken' | 'forbidden',
    message: string = code,
  ) {
    super(message);
    this.name = 'CatalogError';
  }
}

export const storeCurrency = () => {
  const c = process.env.STORE_CURRENCY ?? 'EUR';
  if (!/^[A-Z]{3}$/.test(c)) throw new Error(`invalid STORE_CURRENCY: ${c}`);
  return c;
};

const Slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120);
const Amount = z.number().int().min(0).max(100_000_000);

export const VariantInput = z.object({
  id: z.string().optional(),
  sku: z.string().trim().min(1).max(64).optional(),
  options: z.record(z.string(), z.string()).default({}),
  price: Amount,
  compareAt: Amount.nullish(),
  cost: Amount.nullish(),
  stock: z.number().int().min(-1_000_000).max(1_000_000).default(0),
  trackStock: z.boolean().default(true),
  allowBackorder: z.boolean().default(false),
  lowStockThreshold: z.number().int().min(0).default(3),
  weightGrams: z.number().int().min(0).nullish(),
  active: z.boolean().default(true),
  mediaId: z.string().max(64).nullish(),
});

export const ProductInput = z.object({
  slug: Slug,
  name: z.string().trim().min(1).max(200),
  description: RichTextSchema.nullish(),
  status: z.enum(['draft', 'active', 'archived']).default('draft'),
  kind: z.enum(['physical', 'digital']).default('physical'),
  brand: z.string().max(100).nullish(),
  options: z.array(z.object({ name: z.string().min(1).max(40), values: z.array(z.string().min(1).max(60)).min(1).max(50) })).max(3).default([]),
  tags: z.array(z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/)).max(30).default([]),
  attributes: z.record(z.string().max(40), z.string().max(200)).default({}),
  translations: z.record(z.string(), z.object({ name: z.string().max(200).optional(), description: RichTextSchema.optional(), seoTitle: z.string().max(70).optional(), seoDescription: z.string().max(170).optional() })).default({}),
  seoTitle: z.string().max(70).nullish(),
  seoDescription: z.string().max(170).nullish(),
  categories: z.array(Slug).max(10).default([]),
  media: z.array(z.string().max(64)).max(30).default([]),
  variants: z.array(VariantInput).min(1).max(100),
});

export type ProductInputData = z.input<typeof ProductInput>;

function validate(input: unknown) {
  const r = ProductInput.safeParse(input);
  if (!r.success) throw new CatalogError('invalid', r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  const p = r.data;
  // Cada variante debe tener un valor válido para cada opción, y no puede haber dos variantes iguales.
  const seen = new Set<string>();
  for (const v of p.variants) {
    for (const o of p.options) if (!o.values.includes(v.options[o.name] ?? '')) throw new CatalogError('invalid', `variant needs a valid "${o.name}"`);
    if (Object.keys(v.options).some((k) => !p.options.some((o) => o.name === k))) throw new CatalogError('invalid', 'variant has unknown options');
    const key = p.options.map((o) => v.options[o.name]).join('\u0000');
    if (seen.has(key)) throw new CatalogError('invalid', `duplicate variant ${key.replaceAll('\u0000', ' / ')}`);
    seen.add(key);
  }
  return p;
}

const variantTitle = (options: Record<string, string>, order: Array<{ name: string }>) => order.map((o) => options[o.name]).filter(Boolean).join(' / ');

async function writeRelations(productId: string, p: ReturnType<typeof validate>, tx: Executor) {
  const currency = storeCurrency();
  const existing = await tx.select({ id: productVariants.id }).from(productVariants).where(eq(productVariants.productId, productId));
  const keep = new Set(p.variants.flatMap((v) => (v.id ? [v.id] : [])));
  const removed = existing.filter((e) => !keep.has(e.id)).map((e) => e.id);
  // Las variantes quitadas se desactivan (los pedidos antiguos las referencian), no se borran.
  if (removed.length) await tx.update(productVariants).set({ active: false }).where(inArray(productVariants.id, removed));
  for (const [position, v] of p.variants.entries()) {
    const values = {
      productId,
      sku: v.sku ?? null,
      title: variantTitle(v.options, p.options),
      options: v.options,
      priceAmount: v.price,
      compareAtAmount: v.compareAt != null && v.compareAt > v.price ? v.compareAt : null,
      costAmount: v.cost ?? null,
      currency,
      stock: v.stock,
      trackStock: v.trackStock,
      allowBackorder: v.allowBackorder,
      lowStockThreshold: v.lowStockThreshold,
      weightGrams: v.weightGrams ?? null,
      active: v.active,
      position,
      mediaId: v.mediaId ?? null,
    };
    if (v.id && existing.some((e) => e.id === v.id)) await tx.update(productVariants).set(values).where(eq(productVariants.id, v.id));
    else await tx.insert(productVariants).values(values);
  }
  await tx.delete(productMedia).where(eq(productMedia.productId, productId));
  if (p.media.length) await tx.insert(productMedia).values(p.media.map((mediaId, position) => ({ productId, mediaId, position })));
  await tx.delete(productCategories).where(eq(productCategories.productId, productId));
  if (p.categories.length) {
    const cats = await tx.select({ id: categories.id, slug: categories.slug }).from(categories).where(inArray(categories.slug, p.categories));
    if (cats.length !== new Set(p.categories).size) throw new CatalogError('invalid', 'unknown category');
    await tx.insert(productCategories).values(cats.map((c) => ({ productId, categoryId: c.id })));
  }
}

const productValues = (p: ReturnType<typeof validate>, prev?: Product) => ({
  slug: p.slug,
  name: p.name,
  description: p.description ?? null,
  status: p.status,
  kind: p.kind,
  brand: p.brand ?? null,
  options: p.options,
  tags: p.tags,
  attributes: p.attributes,
  translations: p.translations,
  seoTitle: p.seoTitle ?? null,
  seoDescription: p.seoDescription ?? null,
  publishedAt: p.status === 'active' ? (prev?.publishedAt ?? new Date()) : (prev?.publishedAt ?? null),
});

export async function createProduct(input: ProductInputData, db = getDb()): Promise<Product> {
  const p = validate(input);
  return withTransaction(async (tx) => {
    const [row] = await tx.insert(products).values(productValues(p)).onConflictDoNothing().returning();
    if (!row) throw new CatalogError('slug_taken', `product slug ${p.slug} exists`);
    await writeRelations(row.id, p, tx);
    return row;
  }, db);
}

export async function updateProduct(id: string, input: ProductInputData, db = getDb()): Promise<Product> {
  const p = validate(input);
  return withTransaction(async (tx) => {
    const [prev] = await tx.select().from(products).where(eq(products.id, id)).for('update');
    if (!prev) throw new CatalogError('not_found');
    const [clash] = await tx.select({ id: products.id }).from(products).where(and(eq(products.slug, p.slug), ne(products.id, id)));
    if (clash) throw new CatalogError('slug_taken', `product slug ${p.slug} exists`);
    const [row] = await tx.update(products).set(productValues(p, prev)).where(eq(products.id, id)).returning();
    await writeRelations(id, p, tx);
    return row!;
  }, db);
}

export type Availability = 'InStock' | 'OutOfStock' | 'BackOrder';

export function availability(v: Pick<Variant, 'trackStock' | 'stock' | 'allowBackorder' | 'active'>): Availability {
  if (!v.active) return 'OutOfStock';
  if (!v.trackStock || v.stock > 0) return 'InStock';
  return v.allowBackorder ? 'BackOrder' : 'OutOfStock';
}

export const variantPrice = (v: Pick<Variant, 'priceAmount' | 'currency'>): Money => money(v.priceAmount, v.currency);

export type ProductView = Product & {
  variants: Array<Variant & { price: Money; compareAt: Money | null; availability: Availability }>;
  media: string[];
  categories: Array<{ slug: string; name: string }>;
  priceRange: { min: Money; max: Money } | null;
  available: boolean;
};

function localize(p: Product, locale?: string): Product {
  const t = locale ? p.translations[locale] : undefined;
  if (!t) return p;
  return { ...p, name: t.name ?? p.name, description: t.description ?? p.description, seoTitle: t.seoTitle ?? p.seoTitle, seoDescription: t.seoDescription ?? p.seoDescription };
}

async function view(p: Product, locale: string | undefined, db: Executor): Promise<ProductView> {
  const vs = await db.select().from(productVariants).where(and(eq(productVariants.productId, p.id), eq(productVariants.active, true))).orderBy(asc(productVariants.position));
  const media = await db.select().from(productMedia).where(eq(productMedia.productId, p.id)).orderBy(asc(productMedia.position));
  const cats = await db
    .select({ slug: categories.slug, name: categories.name, translations: categories.translations })
    .from(productCategories)
    .innerJoin(categories, eq(categories.id, productCategories.categoryId))
    .where(eq(productCategories.productId, p.id));
  const variants = vs.map((v) => ({ ...v, price: variantPrice(v), compareAt: v.compareAtAmount ? money(v.compareAtAmount, v.currency) : null, availability: availability(v) }));
  const prices = variants.map((v) => v.priceAmount);
  const currency = variants[0]?.currency ?? storeCurrency();
  return {
    ...localize(p, locale),
    variants,
    media: media.map((m) => m.mediaId),
    categories: cats.map((c) => ({ slug: c.slug, name: (locale && c.translations[locale]?.name) || c.name })),
    priceRange: prices.length ? { min: money(Math.min(...prices), currency), max: money(Math.max(...prices), currency) } : null,
    available: variants.some((v) => v.availability !== 'OutOfStock'),
  };
}

/** Producto activo por slug (o cualquier estado con `includeDraft`, para vista previa del admin). */
export async function getProduct(slug: string, opts: { locale?: string; includeDraft?: boolean } = {}, db: Executor = getDb()): Promise<ProductView | null> {
  const [p] = await db.select().from(products).where(and(eq(products.slug, slug), opts.includeDraft ? ne(products.status, 'archived') : eq(products.status, 'active')));
  return p ? view(p, opts.locale, db) : null;
}

export async function getProductById(id: string, db: Executor = getDb()): Promise<ProductView | null> {
  const [p] = await db.select().from(products).where(eq(products.id, id));
  return p ? view(p, undefined, db) : null;
}

export type ProductSort = 'newest' | 'price-asc' | 'price-desc' | 'name';

export type ListProductsOptions = {
  category?: string;
  collection?: string;
  tag?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sort?: ProductSort;
  page?: number;
  perPage?: number;
  locale?: string;
};

export type ProductSummary = {
  id: string;
  slug: string;
  name: string;
  image: string | null;
  price: Money;
  compareAt: Money | null;
  priceMax: Money;
  available: boolean;
  tags: string[];
};

/** Productos activos con filtros. El precio de orden/filtro es el mínimo de sus variantes activas. */
export async function listProducts(o: ListProductsOptions = {}, db: Executor = getDb()): Promise<{ products: ProductSummary[]; total: number; page: number; pages: number }> {
  const perPage = Math.min(Math.max(o.perPage ?? 24, 1), 100);
  const page = Math.max(Math.floor(o.page ?? 1), 1);
  const pv = db
    .select({
      productId: productVariants.productId,
      minPrice: sql<number>`min(${productVariants.priceAmount})`.as('min_price'),
      maxPrice: sql<number>`max(${productVariants.priceAmount})`.as('max_price'),
      minCompare: sql<number | null>`min(${productVariants.compareAtAmount})`.as('min_compare'),
      currency: sql<string>`min(${productVariants.currency})`.as('currency'),
      available: sql<boolean>`bool_or(not ${productVariants.trackStock} or ${productVariants.stock} > 0 or ${productVariants.allowBackorder})`.as('available'),
    })
    .from(productVariants)
    .where(eq(productVariants.active, true))
    .groupBy(productVariants.productId)
    .as('pv');
  const conds: SQL[] = [eq(products.status, 'active')];
  if (o.category) conds.push(sql`exists (select 1 from ${productCategories} pc join ${categories} c on c.id = pc.category_id where pc.product_id = ${products.id} and c.slug = ${o.category})`);
  if (o.collection) conds.push(sql`exists (select 1 from ${collectionProducts} cp join ${collections} cl on cl.id = cp.collection_id where cp.product_id = ${products.id} and cl.slug = ${o.collection})`);
  if (o.tag) conds.push(sql`${products.tags} @> ${JSON.stringify([o.tag])}::jsonb`);
  if (o.minPrice !== undefined) conds.push(gte(pv.minPrice, o.minPrice));
  if (o.maxPrice !== undefined) conds.push(lte(pv.minPrice, o.maxPrice));
  if (o.inStock) conds.push(sql`${pv.available}`);
  const where = and(...conds);
  const order =
    o.sort === 'price-asc' ? [asc(pv.minPrice)] : o.sort === 'price-desc' ? [desc(pv.minPrice)] : o.sort === 'name' ? [asc(products.name)] : [desc(products.publishedAt)];
  if (o.collection && !o.sort)
    order.unshift(sql`(select cp.position from ${collectionProducts} cp join ${collections} cl on cl.id = cp.collection_id where cp.product_id = ${products.id} and cl.slug = ${o.collection})`);
  const [total] = await db.select({ n: count() }).from(products).innerJoin(pv, eq(pv.productId, products.id)).where(where);
  const rows = await db
    .select({ p: products, pv: { minPrice: pv.minPrice, maxPrice: pv.maxPrice, minCompare: pv.minCompare, currency: pv.currency, available: pv.available } })
    .from(products)
    .innerJoin(pv, eq(pv.productId, products.id))
    .where(where)
    .orderBy(...order, asc(products.id))
    .limit(perPage)
    .offset((page - 1) * perPage);
  const images = rows.length
    ? await db.select().from(productMedia).where(and(inArray(productMedia.productId, rows.map((r) => r.p.id)), eq(productMedia.position, 0)))
    : [];
  return {
    total: total?.n ?? 0,
    page,
    pages: Math.max(1, Math.ceil((total?.n ?? 0) / perPage)),
    products: rows.map(({ p, pv: v }) => {
      const lp = localize(p, o.locale);
      return {
        id: p.id,
        slug: p.slug,
        name: lp.name,
        image: images.find((i) => i.productId === p.id)?.mediaId ?? null,
        price: money(Number(v.minPrice), v.currency),
        compareAt: v.minCompare ? money(Number(v.minCompare), v.currency) : null,
        priceMax: money(Number(v.maxPrice), v.currency),
        available: Boolean(v.available),
        tags: p.tags,
      };
    }),
  };
}

/**
 * Reserva `qty` unidades dentro de la transacción `tx` (bloquea la fila: dos compras simultáneas de la última unidad
 * no pueden ganar ambas). Lanza `out_of_stock` si no hay y la variante no admite pedidos sin stock.
 */
export async function reserveStock(variantId: string, qty: number, tx: Executor): Promise<Variant> {
  if (!Number.isInteger(qty) || qty <= 0) throw new CatalogError('invalid', 'quantity must be a positive integer');
  const [v] = await tx.select().from(productVariants).where(eq(productVariants.id, variantId)).for('update');
  if (!v || !v.active) throw new CatalogError('not_found', `variant ${variantId} not available`);
  if (v.trackStock && !v.allowBackorder && v.stock < qty) throw new CatalogError('out_of_stock', `only ${Math.max(v.stock, 0)} left of ${variantId}`);
  if (!v.trackStock) return v;
  const [updated] = await tx.update(productVariants).set({ stock: sql`${productVariants.stock} - ${qty}` }).where(eq(productVariants.id, variantId)).returning();
  return updated!;
}

/** Devuelve unidades al stock (pago caducado, cancelación, devolución). */
export async function releaseStock(variantId: string, qty: number, tx: Executor = getDb()): Promise<void> {
  await tx
    .update(productVariants)
    .set({ stock: sql`${productVariants.stock} + ${qty}` })
    .where(and(eq(productVariants.id, variantId), eq(productVariants.trackStock, true)));
}

/** Variantes activas con stock en o bajo su umbral (aviso del panel). */
export async function lowStockVariants(db: Executor = getDb()) {
  return db
    .select({ id: productVariants.id, sku: productVariants.sku, title: productVariants.title, stock: productVariants.stock, product: products.name })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(and(eq(productVariants.active, true), eq(productVariants.trackStock, true), sql`${productVariants.stock} <= ${productVariants.lowStockThreshold}`, ne(products.status, 'archived')));
}

export async function getVariants(ids: string[], db: Executor = getDb()) {
  if (!ids.length) return [];
  return db
    .select({ variant: productVariants, product: { id: products.id, slug: products.slug, name: products.name, status: products.status, kind: products.kind } })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(inArray(productVariants.id, ids));
}
