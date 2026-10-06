// Recursos del panel: productos (con variantes en el mismo formulario), categorías y colecciones.
import { and, asc, count, desc, eq, ilike, or, type SQL, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { AdminContext, AdminResource } from '../contracts/index.js';
import { getDb } from '../db/index.js';
import { CatalogError, createProduct, getProductById, ProductInput, type ProductView, updateProduct } from './products.js';
import { type Category, categories, products } from './schema.js';
import { CategoryInput, upsertCategory } from './taxonomy.js';

async function need(ctx: AdminContext, perm: string) {
  if (!(await ctx.can(perm))) throw new CatalogError('forbidden', `forbidden: ${perm}`);
}

export const productsAdminResource: AdminResource<ProductView> = {
  name: 'products',
  label: { singular: 'Product', plural: 'Products' },
  group: 'Store',
  fields: [
    { name: 'name', label: 'Name', type: 'text', required: true, list: true },
    { name: 'slug', label: 'Slug', type: 'slug', required: true },
    { name: 'status', label: 'Status', type: 'select', list: true, options: ['draft', 'active', 'archived'].map((v) => ({ value: v, label: v })) },
    { name: 'description', label: 'Description', type: 'richText' },
    { name: 'media', label: 'Images', type: 'media', many: true },
    { name: 'categories', label: 'Categories', type: 'relation', relationTo: 'categories', many: true },
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
    const views = await Promise.all(rows.map((r) => getProductById(r.id)));
    return { rows: views.filter((v): v is ProductView => v !== null), total: total?.n ?? 0 };
  },
  async get(id, ctx) {
    await need(ctx, 'products:read');
    return getProductById(id);
  },
  async create(input, ctx) {
    await need(ctx, 'products:create');
    const p = await createProduct(input as z.input<typeof ProductInput>);
    return (await getProductById(p.id))!;
  },
  async update(id, input, ctx) {
    await need(ctx, 'products:update');
    await updateProduct(id, input as z.input<typeof ProductInput>);
    return (await getProductById(id))!;
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
        return (await getProductById(id))!;
      },
    },
  ],
};

export const categoriesAdminResource: AdminResource<Category> = {
  name: 'categories',
  label: { singular: 'Category', plural: 'Categories' },
  group: 'Store',
  fields: [
    { name: 'name', label: 'Name', type: 'text', required: true, list: true },
    { name: 'slug', label: 'Slug', type: 'slug', required: true, list: true },
    { name: 'parent', label: 'Parent', type: 'relation', relationTo: 'categories' },
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
    return { rows, total: total?.n ?? 0 };
  },
  async get(id, ctx) {
    await need(ctx, 'products:read');
    const [row] = await getDb().select().from(categories).where(eq(categories.id, id));
    return row ?? null;
  },
  async create(input, ctx) {
    await need(ctx, 'products:create');
    return upsertCategory(input as z.input<typeof CategoryInput>);
  },
  async update(_id, input, ctx) {
    await need(ctx, 'products:update');
    return upsertCategory(input as z.input<typeof CategoryInput>);
  },
  async delete(id, ctx) {
    await need(ctx, 'products:delete');
    await getDb().delete(categories).where(eq(categories.id, id));
  },
};

export const catalogAdminResources = () => [productsAdminResource, categoriesAdminResource];
