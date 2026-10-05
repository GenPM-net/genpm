// Recetas compose (V03-05): GET /v1/recipes y /v1/recipes/:slug (públicas, cacheables). El staff las gestiona en
// PUT/DELETE /v1/admin/recipes/:slug (routes/admin.ts).

import { pickSummary, RECIPE_SLUG_RE, type Recipe } from '@genpm/manifest';
import { Hono } from 'hono';
import { CACHE } from '../cache.js';
import type { AppEnv } from '../env.js';
import { httpError } from '../http.js';

type Row = { slug: string; summary: string | null; specs: string; updated_at: number };

function view(r: Row, locale: string) {
  const s = r.summary ? (JSON.parse(r.summary) as Recipe['s']) : undefined;
  return {
    name: r.slug,
    summary: (s && pickSummary(s, locale)) ?? null,
    p: JSON.parse(r.specs) as string[],
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

export const recipes = new Hono<AppEnv>()
  .get('/', async (c) => {
    const { results } = await c.env.DB.prepare(
      'SELECT slug, summary, specs, updated_at FROM recipes WHERE registry_id = ?1 ORDER BY slug LIMIT 200',
    )
      .bind(c.get('tenant').registryId)
      .all<Row>();
    c.header('Cache-Control', CACHE.short);
    return c.json({ recipes: results.map((r) => view(r, c.get('locale'))) });
  })
  .get('/:slug', async (c) => {
    const slug = c.req.param('slug');
    if (!RECIPE_SLUG_RE.test(slug)) throw httpError('E_NOT_FOUND', { name: slug });
    const row = await c.env.DB.prepare(
      'SELECT slug, summary, specs, updated_at FROM recipes WHERE registry_id = ?1 AND slug = ?2',
    )
      .bind(c.get('tenant').registryId, slug)
      .first<Row>();
    if (!row) throw httpError('E_NOT_FOUND', { name: slug });
    c.header('Cache-Control', CACHE.short);
    return c.json(view(row, c.get('locale')));
  });
