// Lectura del blog: listados filtrados y paginados, post con relaciones resueltas, relacionados y archivo.
import { and, eq, sql } from 'drizzle-orm';
import { contentEntries, countEntries, getEntry, listEntries } from '../content/index.ts';
import type { ContentEntry, ContentListQuery } from '../contracts/index.ts';
import { getDb } from '../db/index.ts';
import { excerpt, readingTime } from '../rich-text/index.ts';
import type { AuthorData, PostData, TaxonomyData } from './collections.ts';

export type PostSummary = {
  id: string;
  slug: string;
  locale: string;
  title: string;
  excerpt: string;
  cover?: string;
  coverAlt?: string;
  authors: string[];
  categories: string[];
  tags: string[];
  featured: boolean;
  membersOnly: boolean;
  readingMinutes: number;
  publishedAt: Date | null;
  updatedAt: Date;
};

export type Named = { slug: string; name: string };
export type Post = PostSummary & {
  data: PostData;
  authorProfiles: Array<{ slug: string } & AuthorData>;
  categoryList: Named[];
  tagList: Named[];
};

export const summarize = (e: ContentEntry<PostData>): PostSummary => ({
  id: e.id,
  slug: e.slug,
  locale: e.locale,
  title: e.data.title,
  excerpt: e.data.excerpt ?? excerpt(e.data.body, 200),
  ...(e.data.cover && { cover: e.data.cover }),
  ...(e.data.coverAlt && { coverAlt: e.data.coverAlt }),
  authors: e.data.authors ?? [],
  categories: e.data.categories ?? [],
  tags: e.data.tags ?? [],
  featured: e.data.featured ?? false,
  membersOnly: e.data.membersOnly ?? false,
  readingMinutes: readingTime(e.data.body),
  publishedAt: e.publishedAt,
  updatedAt: e.updatedAt,
});

export type ListPostsOptions = {
  locale?: string;
  category?: string;
  tag?: string;
  author?: string;
  series?: string;
  featured?: boolean;
  page?: number;
  perPage?: number;
  draft?: boolean;
};

export async function listPosts(o: ListPostsOptions = {}): Promise<{ posts: PostSummary[]; total: number; page: number; pages: number }> {
  const perPage = Math.min(Math.max(o.perPage ?? 10, 1), 100);
  const page = Math.max(Math.floor(o.page ?? 1), 1);
  const contains: Record<string, string> = {};
  if (o.category) contains.categories = o.category;
  if (o.tag) contains.tags = o.tag;
  if (o.author) contains.authors = o.author;
  const where: ContentListQuery['where'] = {};
  if (o.featured !== undefined) where.featured = o.featured;
  const q: ContentListQuery = { locale: o.locale, draft: o.draft, contains, where };
  if (o.series) {
    // Filtra en SQL (no entre los N más recientes) y ordena por número de capítulo.
    const all = await listEntries<PostData>('posts', { ...q, where: { ...where, 'series.slug': o.series }, limit: 500, orderBy: 'publishedAt' });
    const inSeries = all.sort((a, b) => (a.data.series?.order ?? 0) - (b.data.series?.order ?? 0));
    return { posts: inSeries.slice((page - 1) * perPage, page * perPage).map(summarize), total: inSeries.length, page, pages: Math.max(1, Math.ceil(inSeries.length / perPage)) };
  }
  const [rows, total] = await Promise.all([
    listEntries<PostData>('posts', { ...q, orderBy: '-publishedAt', limit: perPage, offset: (page - 1) * perPage }),
    countEntries('posts', q),
  ]);
  return { posts: rows.map(summarize), total, page, pages: Math.max(1, Math.ceil(total / perPage)) };
}

async function named(collection: string, slugs: string[], locale?: string): Promise<Named[]> {
  const out: Named[] = [];
  for (const slug of slugs) {
    const e = await getEntry<TaxonomyData>(collection, slug, { locale });
    out.push({ slug, name: e?.data.name ?? slug });
  }
  return out;
}

/** Post publicado con autores, categorías y etiquetas resueltos (o null). */
export async function getPost(slug: string, opts: { locale?: string; draft?: boolean } = {}): Promise<Post | null> {
  const e = await getEntry<PostData>('posts', slug, opts);
  if (!e) return null;
  const s = summarize(e);
  const authorProfiles: Post['authorProfiles'] = [];
  for (const a of s.authors) {
    const author = await getEntry<AuthorData>('authors', a, { locale: opts.locale });
    if (author) authorProfiles.push({ slug: a, ...author.data });
  }
  return { ...s, data: e.data, authorProfiles, categoryList: await named('categories', s.categories, opts.locale), tagList: await named('tags', s.tags, opts.locale) };
}

/** Posts que comparten más etiquetas/categorías con `post` (entre los 200 más recientes). */
export async function relatedPosts(post: Pick<PostSummary, 'slug' | 'tags' | 'categories' | 'locale'>, limit = 3): Promise<PostSummary[]> {
  const recent = await listEntries<PostData>('posts', { locale: post.locale, orderBy: '-publishedAt', limit: 200 });
  const score = (e: ContentEntry<PostData>) =>
    (e.data.tags ?? []).filter((t) => post.tags.includes(t)).length * 2 + (e.data.categories ?? []).filter((c) => post.categories.includes(c)).length;
  return recent
    .filter((e) => e.slug !== post.slug)
    .map((e) => ({ e, s: score(e) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || (b.e.publishedAt?.getTime() ?? 0) - (a.e.publishedAt?.getTime() ?? 0))
    .slice(0, limit)
    .map((x) => summarize(x.e));
}

/** Número de posts publicados por año y mes (zona UTC), del más reciente al más antiguo. */
export async function archive(opts: { locale?: string } = {}): Promise<Array<{ year: number; month: number; count: number }>> {
  const month = sql<string>`to_char(${contentEntries.publishedAt} at time zone 'UTC', 'YYYY-MM')`;
  const rows = await getDb()
    .select({ ym: month, n: sql<number>`count(distinct ${contentEntries.groupId})`.mapWith(Number) })
    .from(contentEntries)
    .where(and(eq(contentEntries.collection, 'posts'), eq(contentEntries.status, 'published'), opts.locale ? eq(contentEntries.locale, opts.locale) : undefined))
    .groupBy(month)
    .orderBy(sql`1 desc`);
  return rows.map((r) => ({ year: Number(r.ym.slice(0, 4)), month: Number(r.ym.slice(5, 7)), count: r.n }));
}

/** Posts publicados en un mes. */
export async function postsInMonth(year: number, month: number, opts: { locale?: string } = {}): Promise<PostSummary[]> {
  const from = Date.UTC(year, month - 1, 1);
  const to = Date.UTC(year, month, 1);
  const rows = await listEntries<PostData>('posts', { locale: opts.locale, orderBy: '-publishedAt', limit: 500, publishedFrom: new Date(from), publishedBefore: new Date(to) });
  return rows.map(summarize);
}
