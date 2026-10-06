// Recursos del panel: productos (con variantes en el mismo formulario), categorías y colecciones.
import { and, asc, count, desc, eq, ilike, inArray, or, type SQL, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { AdminContext, AdminResource } from '../contracts/index.ts';
import { getDb } from '../db/index.ts';
import { CatalogError, createProduct, getProductById, ProductInput, type ProductView, updateProduct, VariantInput } from './products.ts';
import { type Category, categories, products } from './schema.ts';
import { CategoryInput, upsertCategory } from './taxonomy.ts';

async function need(ctx: AdminContext, perm: string) {
  if (!(await ctx.can(perm))) throw new CatalogError('forbidden', `forbidden: ${perm}`);
}

/**
 * Fila del panel: el producto con la misma forma que su entrada (`ProductInput`), para que editar y guardar sea un
 * ida y vuelta sin pérdidas: categorías por slug y variantes con precios en unidades menores.
 */
export type ProductAdminRow = Omit<ProductView, 'categories' | 'variants'> & {
  categories: string[];
  variants: Array<z.input<typeof VariantInput>>;
};

export function toAdminRow(p: ProductView): ProductAdminRow {
  return {
    ...p,
    categories: p.categories.map((c) => c.slug),
    variants: p.variants.map((v) => ({
      id: v.id,
      ...(v.sku && { sku: v.sku }),
      options: v.options,
      price: v.priceAmount,
      compareAt: v.compareAtAmount,
      cost: v.costAmount,
      stock: v.stock,
      trackStock: v.trackStock,
      allowBackorder: v.allowBackorder,
      lowStockThreshold: v.lowStockThreshold,
      weightGrams: v.weightGrams,
      active: v.active,
      mediaId: v.mediaId,
    })),
  };
}

const row = async (id: string) => {
  const v = await getProductById(id);
  return v ? toAdminRow(v) : null;
};

export const productsAdminResource: AdminResource<ProductAdminRow> = {
  name: 'products',
  label: { singular: 'Product', plural: 'Products' },
  group: 'Store',
  fields: [
    { name: 'name', label: 'Name', type: 'text', required: true, list: true },
    { name: 'slug', label: 'Slug', type: 'slug', required: true },
    { name: 'status', label: 'Status', type: 'select', list: true, options: ['draft', 'active', 'archived'].map((v) => ({ value: v, label: v })) },
    { name: 'description', label: 'Description', type: 'richText' },
    { name: 'media', label: 'Images', type: 'media', many: true },
    { name: 'categories', label: 'Categories', type: 'relation', relationTo: 'product-categories', relationKey: 'slug', many: true },
    { name: 'options', label: 'Options (e.g. Size: S, M, L)', type: 'json' },
    { name: 'variants', label: 'Variants (price in cents, stock, SKU)', type: 'json', required: true },
    { name: 'tags', label: 'Tags', type: 'json' },
    { name: 'brand', label: 'Brand', type: 'text' },
    { name: 'seoTitle', label: 'SEO title', type: 'text' },
    { name: 'seoDescription', label: 'SEO description', type: 'textarea' },
  ],
  input: ProductInput,
  title: (p) => p.name,
  async list(q, ctx) {
    await need(ctx, 'products:read');
    const conds: SQL[] = [];
    if (q.filters?.status) conds.push(sql`${products.status} = ${q.filters.status}`);
    if (q.search) {
      const like = `%${q.search.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
      conds.push(or(ilike(products.name, like), ilike(products.slug, like), sql`exists (select 1 from product_variants v where v.product_id = ${products.id} and v.sku ilike ${like})`)!);
    }
    const where = conds.length ? and(...conds) : undefined;
    const [total] = await getDb().select({ n: count() }).from(products).where(where);
    const rows = await getDb().select({ id: products.id }).from(products).where(where).orderBy(desc(products.updatedAt)).limit(q.pageSize).offset((Math.max(q.page, 1) - 1) * q.pageSize);
    const views = await Promise.all(rows.map((r) => row(r.id)));
    return { rows: views.filter((v): v is ProductAdminRow => v !== null), total: total?.n ?? 0 };
  },
  async get(id, ctx) {
    await need(ctx, 'products:read');
    return row(id);
  },
  async create(input, ctx) {
    await need(ctx, 'products:create');
    const p = await createProduct(input as z.input<typeof ProductInput>);
    return (await row(p.id))!;
  },
  async update(id, input, ctx) {
    await need(ctx, 'products:update');
    await updateProduct(id, input as z.input<typeof ProductInput>);
    return (await row(id))!;
  },
  actions: [
    {
      name: 'archive',
      label: 'Archive',
      permission: 'products:update',
      confirm: true,
      available: (p) => p.status !== 'archived',
      async run(id, _i, ctx) {
        await need(ctx, 'products:update');
        await getDb().update(products).set({ status: 'archived' }).where(eq(products.id, id));
        return (await row(id))!;
      },
    },
  ],
};

/** Añade `parent` (slug del padre) a las filas: así el formulario usa la misma forma que `CategoryInput`. */
async function withParent(rows: Category[]): Promise<Array<Category & { parent: string | null }>> {
  const ids = [...new Set(rows.map((r) => r.parentId).filter((x): x is string => !!x))];
  const parents = ids.length ? await getDb().select({ id: categories.id, slug: categories.slug }).from(categories).where(inArray(categories.id, ids)) : [];
  return rows.map((r) => ({ ...r, parent: parents.find((p) => p.id === r.parentId)?.slug ?? null }));
}

/** Nombre `product-categories` para no chocar con las categorías del blog en el mismo panel. */
export const categoriesAdminResource: AdminResource<Category & { parent: string | null }> = {
  name: 'product-categories',
  label: { singular: 'Category', plural: 'Categories' },
  group: 'Store',
  fields: [
    { name: 'name', label: 'Name', type: 'text', required: true, list: true },
    { name: 'slug', label: 'Slug', type: 'slug', required: true, list: true },
    { name: 'parent', label: 'Parent', type: 'relation', relationTo: 'product-categories', relationKey: 'slug' },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'position', label: 'Order', type: 'number' },
  ],
  input: CategoryInput,
  title: (c) => c.name,
  async list(q, ctx) {
    await need(ctx, 'products:read');
    const where = q.search ? ilike(categories.name, `%${q.search.replace(/[%_\\]/g, (m) => `\\${m}`)}%`) : undefined;
    const [total] = await getDb().select({ n: count() }).from(categories).where(where);
    const rows = await getDb().select().from(categories).where(where).orderBy(asc(categories.position), asc(categories.name)).limit(q.pageSize).offset((Math.max(q.page, 1) - 1) * q.pageSize);
    return { rows: await withParent(rows), total: total?.n ?? 0 };
  },
  async get(id, ctx) {
    await need(ctx, 'products:read');
    const [row] = await getDb().select().from(categories).where(eq(categories.id, id));
    return row ? ((await withParent([row]))[0] ?? null) : null;
  },
  async create(input, ctx) {
    await need(ctx, 'products:create');
    return (await withParent([await upsertCategory(input as z.input<typeof CategoryInput>)]))[0]!;
  },
  async update(_id, input, ctx) {
    await need(ctx, 'products:update');
    return (await withParent([await upsertCategory(input as z.input<typeof CategoryInput>)]))[0]!;
  },
  async delete(id, ctx) {
    await need(ctx, 'products:delete');
    await getDb().delete(categories).where(eq(categories.id, id));
  },
};

export const catalogAdminResources = () => [productsAdminResource, categoriesAdminResource];
