// Categorías (árbol) y colecciones manuales ordenadas.
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { type Executor, getDb, withTransaction } from '../db/index.js';
import { CatalogError } from './products.js';
import { type Category, categories, collectionProducts, collections, products } from './schema.js';

const Slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120);
export const CategoryInput = z.object({
  slug: Slug,
  name: z.string().min(1).max(120),
  description: z.string().max(1000).nullish(),
  parent: Slug.nullish(),
  position: z.number().int().default(0),
  translations: z.record(z.string(), z.object({ name: z.string().max(120).optional(), description: z.string().max(1000).optional() })).default({}),
});

/** Crea o actualiza (por slug) una categoría. Rechaza ciclos en el árbol. */
export async function upsertCategory(input: z.input<typeof CategoryInput>, db: Executor = getDb()): Promise<Category> {
  const c = CategoryInput.parse(input);
  let parentId: string | null = null;
  if (c.parent) {
    const all = await db.select().from(categories);
    const parent = all.find((x) => x.slug === c.parent);
    if (!parent) throw new CatalogError('invalid', `unknown parent ${c.parent}`);
    for (let cur: Category | undefined = parent; cur; cur = all.find((x) => x.id === cur!.parentId))
      if (cur.slug === c.slug) throw new CatalogError('invalid', 'category cycle');
    parentId = parent.id;
  }
  const values = { slug: c.slug, name: c.name, description: c.description ?? null, parentId, position: c.position, translations: c.translations };
  const [row] = await db.insert(categories).values(values).onConflictDoUpdate({ target: categories.slug, set: values }).returning();
  return row!;
}

export type CategoryNode = Category & { children: CategoryNode[] };

/** Árbol completo de categorías ordenado por `position`. */
export async function categoryTree(db: Executor = getDb()): Promise<CategoryNode[]> {
  const all = await db.select().from(categories).orderBy(asc(categories.position), asc(categories.name));
  const nodes = new Map(all.map((c) => [c.id, { ...c, children: [] as CategoryNode[] }]));
  const roots: CategoryNode[] = [];
  for (const n of nodes.values()) (n.parentId && nodes.get(n.parentId) ? nodes.get(n.parentId)!.children : roots).push(n);
  return roots;
}

/** Crea o actualiza una colección y fija sus productos en el orden dado (por slug de producto). */
export async function setCollection(input: { slug: string; name: string; description?: string | null; products: string[] }, db = getDb()) {
  const slug = Slug.parse(input.slug);
  return withTransaction(async (tx) => {
    const values = { slug, name: input.name.slice(0, 120), description: input.description ?? null };
    const [col] = await tx.insert(collections).values(values).onConflictDoUpdate({ target: collections.slug, set: values }).returning();
    await tx.delete(collectionProducts).where(eq(collectionProducts.collectionId, col!.id));
    const rows = await tx.select({ id: products.id, slug: products.slug }).from(products);
    const items = input.products.map((s, position) => {
      const p = rows.find((r) => r.slug === s);
      if (!p) throw new CatalogError('invalid', `unknown product ${s}`);
      return { collectionId: col!.id, productId: p.id, position };
    });
    if (items.length) await tx.insert(collectionProducts).values(items);
    return col!;
  }, db);
}
