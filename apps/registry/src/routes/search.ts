// GET /v1/search (api-spec §4.1): FTS5 + ranking bm25 × popularidad; patrocinado aparte solo con sponsored=1 (ADR-010).

import glossary from '@genpm/i18n/glossary.json';
import { Hono } from 'hono';
import { z } from 'zod';
import { CACHE, cached, cacheKey } from '../cache.js';
import type { AppEnv } from '../env.js';
import { ftsMatch, searchCacheKey } from '../fts.js';
import { httpError } from '../http.js';
import { compactSearchRow, longSearchRow, summaryOf } from '../views.js';
import { decodeCursor, encodeCursor, repoOf, wantsCompact } from './util.js';

const Query = z.object({
  q: z.string().max(100).optional(),
  mcp: z.enum(['0', '1']).optional(),
  scope: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]{0,38}$/)
    .optional(),
  sort: z.enum(['relevance', 'installs', 'recent']).default('relevance'),
  sponsored: z.enum(['0', '1']).default('0'),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  cursor: z.string().max(200).optional(),
});

const synonyms = (glossary as { synonyms: Record<string, string[]> }).synonyms;

export const search = new Hono<AppEnv>().get(
  '/',
  cached({ control: () => CACHE.search, key: (c) => cacheKey(c, searchCacheKey) }),
  async (c) => {
    const parsed = Query.safeParse(c.req.query());
    if (!parsed.success)
      throw httpError('E_BAD_REQUEST', { detail: parsed.error.issues[0]?.path.join('.') ?? 'query' });
    const q = parsed.data;
    const keywords =
      c.req
        .queries('k')
        ?.filter((k) => /^[a-z0-9-]{2,32}$/.test(k))
        .slice(0, 5) ?? [];
    const repo = repoOf(c);
    const fts = q.q ? ftsMatch(q.q, synonyms) : null;
    const offset = decodeCursor(q.cursor);
    const locale = c.get('locale');
    const { rows, total } =
      q.q && !fts
        ? { rows: [], total: 0 }
        : await repo.search({
            match: fts?.match ?? null,
            cjk: fts?.cjk ?? false,
            keywords,
            mcp: q.mcp === '1',
            scope: q.scope ?? null,
            sort: q.sort,
            limit: q.limit,
            offset,
          });
    const kws = await Promise.all(rows.map((r) => repo.keywordsOf(r.id)));
    const nx = offset + rows.length < total ? encodeCursor(offset + rows.length) : null;
    if (wantsCompact(c)) {
      return c.json({ r: rows.map((r, i) => compactSearchRow(r, kws[i]!, locale)), nx });
    }
    let sponsored = null;
    if (q.sponsored === '1') {
      const s = await repo.sponsoredSlot(
        [...keywords, ...(fts ? (q.q ?? '').toLowerCase().split(/\s+/) : [])],
        Date.now(),
      );
      if (s) {
        sponsored = {
          name: s.full_name,
          version: s.latest_version,
          summary: summaryOf(s.summary, locale) ?? null,
          label: 'Sponsored',
          campaignId: s.campaign_id,
        };
      }
    }
    return c.json({ results: rows.map((r, i) => longSearchRow(r, kws[i]!, locale)), sponsored, next: nx, total });
  },
);
