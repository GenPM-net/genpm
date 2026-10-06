import { beforeEach, describe, expect, it } from 'vitest';
import type { AdminContext } from '../contracts/index.js';
import { testDb } from '../db/__fixtures__/pglite.js';
import { type Db, withTransaction } from '../db/index.js';
import { docFromText } from '../rich-text/index.js';
import * as schema from './schema.js';
import {
  availability,
  CatalogError,
  categoryTree,
  createProduct,
  getProduct,
  listProducts,
  lowStockVariants,
  productSearchSource,
  productSitemapSource,
  categoriesAdminResource,
  productsAdminResource,
  type ProductInputData,
  releaseStock,
  reserveStock,
  setCollection,
  updateProduct,
  upsertCategory,
} from './index.js';

let db: Db;
const mug = (over: Partial<ProductInputData> = {}): ProductInputData => ({
  slug: 'mug',
  name: 'Ceramic mug',
  status: 'active',
  description: docFromText('Handmade in Valencia'),
  options: [{ name: 'Color', values: ['Red', 'Blue'] }],
  tags: ['kitchen'],
  attributes: { material: 'ceramic' },
  categories: ['kitchen'],
  media: ['med_a', 'med_b'],
  variants: [
    { sku: 'MUG-R', options: { Color: 'Red' }, price: 1500, compareAt: 1900, stock: 1 },
    { sku: 'MUG-B', options: { Color: 'Blue' }, price: 1700, stock: 0, allowBackorder: true },
  ],
  ...over,
});
const code = (p: Promise<unknown>) => p.then(() => 'ok', (e) => (e instanceof CatalogError ? e.code : Promise.reject(e)));

beforeEach(async () => {
  db = await testDb(schema);
  process.env.STORE_CURRENCY = 'EUR';
  await upsertCategory({ slug: 'home', name: 'Home' });
  await upsertCategory({ slug: 'kitchen', name: 'Kitchen', parent: 'home', translations: { es: { name: 'Cocina' } } });
});

describe('products', () => {
  it('creates products with variants, titles, price ranges and availability', async () => {
    await createProduct(mug({ translations: { es: { name: 'Taza de cerámica' } } }));
    const p = (await getProduct('mug'))!;
    expect(p.variants.map((v) => [v.title, v.price.amount, v.compareAt?.amount ?? null, v.availability])).toEqual([
      ['Red', 1500, 1900, 'InStock'],
      ['Blue', 1700, null, 'BackOrder'],
    ]);
    expect(p).toMatchObject({ media: ['med_a', 'med_b'], categories: [{ slug: 'kitchen', name: 'Kitchen' }], available: true });
    expect(p.priceRange).toEqual({ min: { amount: 1500, currency: 'EUR' }, max: { amount: 1700, currency: 'EUR' } });
    const es = (await getProduct('mug', { locale: 'es' }))!;
    expect([es.name, es.categories[0]!.name]).toEqual(['Taza de cerámica', 'Cocina']);
  });

  it('validates options, duplicates, slugs and categories; compare-at only when higher', async () => {
    expect(await code(createProduct(mug({ variants: [{ options: { Color: 'Green' }, price: 1 }] })))).toBe('invalid');
    expect(await code(createProduct(mug({ variants: [{ options: { Color: 'Red' }, price: 1 }, { options: { Color: 'Red' }, price: 2 }] })))).toBe('invalid');
    expect(await code(createProduct(mug({ categories: ['nope'] })))).toBe('invalid');
    expect(await code(createProduct(mug({ slug: 'Bad Slug' })))).toBe('invalid');
    await createProduct(mug({ variants: [{ options: { Color: 'Red' }, price: 2000, compareAt: 1500 }] }));
    expect((await getProduct('mug'))!.variants[0]!.compareAt).toBeNull();
    expect(await code(createProduct(mug()))).toBe('slug_taken');
  });

  it('drafts and archived products are hidden; removed variants are deactivated, not deleted', async () => {
    const p = await createProduct(mug({ status: 'draft' }));
    expect(await getProduct('mug')).toBeNull();
    expect(await getProduct('mug', { includeDraft: true })).not.toBeNull();
    const full = (await getProduct('mug', { includeDraft: true }))!;
    await updateProduct(p.id, mug({ variants: [{ id: full.variants[0]!.id, sku: 'MUG-R', options: { Color: 'Red' }, price: 1600, stock: 5 }] }));
    const after = (await getProduct('mug'))!;
    expect(after.variants.map((v) => [v.sku, v.price.amount])).toEqual([['MUG-R', 1600]]);
    expect(await db.select().from(schema.productVariants)).toHaveLength(2);
  });
});

describe('listing', () => {
  beforeEach(async () => {
    await createProduct(mug());
    await createProduct(mug({ slug: 'plate', name: 'Plate', tags: ['dining'], categories: ['home'], options: [], variants: [{ price: 900, stock: 0 }] }));
    await createProduct(mug({ slug: 'bowl', name: 'Bowl', options: [], categories: [], variants: [{ price: 2500, stock: 3 }] }));
    await createProduct(mug({ slug: 'secret', name: 'Draft', status: 'draft', options: [], variants: [{ price: 1 }] }));
  });

  it('filters by category, tag, price and stock, and sorts', async () => {
    expect((await listProducts()).total).toBe(3);
    expect((await listProducts({ category: 'kitchen' })).products.map((p) => p.slug)).toEqual(['mug']);
    expect((await listProducts({ tag: 'dining' })).products.map((p) => p.slug)).toEqual(['plate']);
    expect((await listProducts({ sort: 'price-asc' })).products.map((p) => [p.slug, p.price.amount])).toEqual([['plate', 900], ['mug', 1500], ['bowl', 2500]]);
    expect((await listProducts({ minPrice: 1000, maxPrice: 2000 })).products.map((p) => p.slug)).toEqual(['mug']);
    expect((await listProducts({ inStock: true, sort: 'name' })).products.map((p) => p.slug)).toEqual(['bowl', 'mug']);
    const page2 = await listProducts({ perPage: 2, page: 2, sort: 'name' });
    expect(page2).toMatchObject({ total: 3, pages: 2 });
    expect(page2.products.map((p) => p.slug)).toEqual(['plate']);
    expect((await listProducts({ sort: 'price-asc' })).products[1]).toMatchObject({ image: 'med_a', compareAt: { amount: 1900 }, priceMax: { amount: 1700 } });
  });

  it('collections keep their manual order', async () => {
    await setCollection({ slug: 'featured', name: 'Featured', products: ['bowl', 'mug'] });
    expect((await listProducts({ collection: 'featured' })).products.map((p) => p.slug)).toEqual(['bowl', 'mug']);
    await expect(setCollection({ slug: 'x', name: 'X', products: ['nope'] })).rejects.toThrow(/unknown product/);
  });

  it('category tree, low stock, sitemap and search sources', async () => {
    const tree = await categoryTree();
    expect(tree.map((c) => [c.slug, c.children.map((x) => x.slug)])).toEqual([['home', ['kitchen']]]);
    await expect(upsertCategory({ slug: 'home', name: 'Home', parent: 'kitchen' })).rejects.toThrow(/cycle/);
    // stock ≤ umbral (3 por defecto): las dos tazas, el plato (0), el bol (3) y el borrador (0).
    expect((await lowStockVariants()).map((v) => v.product).sort()).toEqual(['Bowl', 'Ceramic mug', 'Ceramic mug', 'Draft', 'Plate']);
    const urls = [];
    for await (const u of productSitemapSource().urls()) urls.push(u.loc);
    expect(urls.sort()).toEqual(['/products/bowl', '/products/mug', '/products/plate']);
    const docs = [];
    for await (const d of productSearchSource().documents()) docs.push(d);
    expect(docs.find((d) => d.url === '/products/mug')?.body).toContain('Handmade in Valencia');
  });
});

describe('stock', () => {
  it('reserves inside a transaction and refuses to oversell the last unit', async () => {
    await createProduct(mug());
    const red = (await getProduct('mug'))!.variants[0]!;
    await withTransaction((tx) => reserveStock(red.id, 1, tx));
    expect(await code(withTransaction((tx) => reserveStock(red.id, 1, tx)))).toBe('out_of_stock');
    // Un fallo después de reservar deshace la reserva (rollback).
    await releaseStock(red.id, 1);
    await expect(withTransaction(async (tx) => { await reserveStock(red.id, 1, tx); throw new Error('payment failed'); })).rejects.toThrow();
    expect((await getProduct('mug'))!.variants[0]!.stock).toBe(1);
    const blue = (await getProduct('mug'))!.variants[1]!;
    expect((await withTransaction((tx) => reserveStock(blue.id, 2, tx))).stock).toBe(-2); // bajo pedido
    expect(availability({ trackStock: true, stock: 0, allowBackorder: false, active: true })).toBe('OutOfStock');
    expect(await code(withTransaction((tx) => reserveStock(red.id, 0, tx)))).toBe('invalid');
  });
});

describe('admin', () => {
  it('permissions and create/update through the resource', async () => {
    const ctx = (perms: string[]): AdminContext => ({ user: { id: 'u', email: null, name: null }, can: async (p) => perms.includes(p) });
    const editor = ctx(['products:read', 'products:create', 'products:update']);
    const created = await productsAdminResource.create!(mug(), editor);
    expect(created.variants).toHaveLength(2);
    expect((await productsAdminResource.list({ page: 1, pageSize: 10, search: 'MUG-B' }, editor)).total).toBe(1);
    await expect(productsAdminResource.list({ page: 1, pageSize: 10 }, ctx([]))).rejects.toMatchObject({ code: 'forbidden' });
    // Ida y vuelta del formulario: lo que devuelve `get` vuelve a ser una entrada válida sin cambios.
    expect(created.categories).toEqual(['kitchen']);
    const { id: _id, createdAt: _c, updatedAt: _u, ...form } = (await productsAdminResource.get(created.id, editor))!;
    const saved = await productsAdminResource.update!(created.id, { ...form, name: 'Mug 2' }, editor);
    expect(saved).toMatchObject({ name: 'Mug 2', categories: ['kitchen'], variants: created.variants });
    const cats = await categoriesAdminResource.list({ page: 1, pageSize: 10 }, editor);
    expect(cats.rows.map((c) => [c.slug, c.parent])).toEqual(expect.arrayContaining([['home', null], ['kitchen', 'home']]));
    expect(categoriesAdminResource.name).toBe('product-categories');
    const archived = await productsAdminResource.actions![0]!.run(created.id, {}, editor);
    expect(archived.status).toBe('archived');
    expect(await getProduct('mug')).toBeNull();
  });
});
