import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { contentEntries, createEntry, saveDraft, schedulePublish, seedEntry } from '../content/index.ts';
import * as contentSchema from '../content/schema.ts';
import { testDb } from '../db/__fixtures__/pglite.ts';
import type { Db } from '../db/index.ts';
import * as jobsSchema from '../jobs/schema.ts';
import { docFromText } from '../rich-text/index.ts';
import {
  archive,
  atomFeed,
  blogAdminResources,
  blogSearchSource,
  blogSitemapSource,
  getPost,
  jsonFeed,
  listPosts,
  postsInMonth,
  relatedPosts,
  rssFeed,
} from './index.ts';

let db: Db;

async function post(slug: string, data: Record<string, unknown>, publishedAt: string) {
  const e = await seedEntry({ collection: 'posts', slug, data: { title: slug.toUpperCase(), body: docFromText(`Body of ${slug} & <stuff>`), ...data } });
  await db.update(contentEntries).set({ publishedAt: new Date(publishedAt) }).where(eq(contentEntries.id, e.id));
  return e;
}

beforeEach(async () => {
  db = await testDb(contentSchema, jobsSchema);
  process.env.SITE_URL = 'https://blog.test';
  await seedEntry({ collection: 'authors', slug: 'ana', data: { name: 'Ana López' } });
  await seedEntry({ collection: 'categories', slug: 'guides', data: { name: 'Guides' } });
  await seedEntry({ collection: 'tags', slug: 'mugs', data: { name: 'Mugs' } });
  await post('first', { authors: ['ana'], categories: ['guides'], tags: ['mugs', 'clay'] }, '2026-08-10T10:00:00Z');
  await post('second', { tags: ['mugs'], featured: true, series: { slug: 'basics', order: 2 } }, '2026-09-05T10:00:00Z');
  await post('third', { categories: ['news'], series: { slug: 'basics', order: 1 }, membersOnly: true, excerpt: 'Members excerpt' }, '2026-09-20T10:00:00Z');
});

describe('listing', () => {
  it('lists newest first with filters and pagination', async () => {
    const all = await listPosts();
    expect(all.posts.map((p) => p.slug)).toEqual(['third', 'second', 'first']);
    expect(all).toMatchObject({ total: 3, pages: 1 });
    expect((await listPosts({ category: 'guides' })).posts.map((p) => p.slug)).toEqual(['first']);
    expect((await listPosts({ tag: 'mugs' })).posts.map((p) => p.slug)).toEqual(['second', 'first']);
    expect((await listPosts({ author: 'ana' })).posts.map((p) => p.slug)).toEqual(['first']);
    expect((await listPosts({ featured: true })).posts.map((p) => p.slug)).toEqual(['second']);
    const p2 = await listPosts({ perPage: 2, page: 2 });
    expect(p2).toMatchObject({ total: 3, pages: 2, page: 2 });
    expect(p2.posts.map((p) => p.slug)).toEqual(['first']);
    expect((await listPosts({ series: 'basics' })).posts.map((p) => p.slug)).toEqual(['third', 'second']);
    expect(all.posts[0]).toMatchObject({ excerpt: 'Members excerpt', readingMinutes: 1, membersOnly: true });
    expect(all.posts[2]!.excerpt).toBe('Body of first & <stuff>');
  });

  it('never shows drafts or scheduled posts', async () => {
    const draft = await createEntry({ collection: 'posts', slug: 'draft', data: { title: 'Draft', body: docFromText('x') } });
    await schedulePublish(draft.id, new Date(Date.now() + 3_600_000));
    await saveDraft((await getPost('first'))!.id, { title: 'Edited but unpublished', body: docFromText('x') });
    const all = await listPosts();
    expect(all.posts.map((p) => p.slug)).not.toContain('draft');
    expect(all.posts.find((p) => p.slug === 'first')?.title).toBe('FIRST');
    expect(await rssFeed({ title: 'Blog' })).not.toContain('Draft');
  });
});

describe('single post, related and archive', () => {
  it('resolves authors and taxonomy names', async () => {
    const p = await getPost('first');
    expect(p?.authorProfiles).toEqual([{ slug: 'ana', name: 'Ana López', links: [] }]);
    expect(p?.categoryList).toEqual([{ slug: 'guides', name: 'Guides' }]);
    expect(p?.tagList).toEqual([{ slug: 'mugs', name: 'Mugs' }, { slug: 'clay', name: 'clay' }]);
    expect(await getPost('nope')).toBeNull();
  });

  it('related by shared tags and categories', async () => {
    const p = (await getPost('first'))!;
    expect((await relatedPosts(p)).map((r) => r.slug)).toEqual(['second']);
  });

  it('series and month archives look past the 500 most recent posts', async () => {
    const [ref] = await db.select().from(contentEntries).where(eq(contentEntries.slug, 'first'));
    const { id: _id, createdAt: _c, updatedAt: _u, ...base } = ref!;
    await db.insert(contentEntries).values(
      Array.from({ length: 510 }, (_, i) => ({ ...base, slug: `new-${i}`, groupId: `grp_new_${i}`, data: { ...base.data, title: `New ${i}` }, publishedAt: new Date(Date.UTC(2026, 9, 1) + i * 60_000) })),
    );
    expect((await listPosts({ series: 'basics' })).posts.map((p) => p.slug)).toEqual(['third', 'second']);
    expect((await listPosts({ series: 'basics' })).total).toBe(2);
    expect((await postsInMonth(2026, 9)).map((p) => p.slug)).toEqual(['third', 'second']);
    expect(await postsInMonth(2026, 10)).toHaveLength(500);
  });

  it('archive by month', async () => {
    expect(await archive()).toEqual([
      { year: 2026, month: 9, count: 2 },
      { year: 2026, month: 8, count: 1 },
    ]);
    expect((await postsInMonth(2026, 9)).map((p) => p.slug)).toEqual(['third', 'second']);
  });
});

describe('feeds', () => {
  it('RSS, Atom and JSON Feed are escaped and keep members-only posts as excerpts', async () => {
    const rss = await rssFeed({ title: 'Tazas & Co', fullContent: true });
    expect(rss).toContain('<title>Tazas &amp; Co</title>');
    expect(rss).toContain('<link>https://blog.test/blog/first</link>');
    expect(rss).toContain('&lt;p&gt;Body of first &amp;amp; &amp;lt;stuff&amp;gt;&lt;/p&gt;');
    expect(rss).not.toContain('<stuff>');
    expect(rss).not.toContain('Body of third');
    expect(rss).toContain('<pubDate>Sun, 20 Sep 2026 10:00:00 GMT</pubDate>');
    const atom = await atomFeed({ title: 'Blog', locale: 'es' });
    expect(atom).toContain('<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="es">');
    expect(atom).toContain('<author><name>Ana López</name></author>');
    const json = JSON.parse(await jsonFeed({ title: 'Blog', fullContent: true }));
    expect(json.version).toBe('https://jsonfeed.org/version/1.1');
    expect(json.items).toHaveLength(3);
    expect(json.items[0].content_html).toBe('<p>Members excerpt</p>');
  });
});

describe('sources and admin', () => {
  it('sitemap and search sources, members-only bodies stay out of search', async () => {
    const urls = [];
    for await (const u of blogSitemapSource().urls()) urls.push(u.loc);
    expect(urls.sort()).toEqual(['/blog', '/blog/first', '/blog/second', '/blog/third']);
    const withoutIndex = [];
    for await (const u of blogSitemapSource(undefined, { index: false }).urls()) withoutIndex.push(u.loc);
    expect(withoutIndex).not.toContain('/blog');
    const docs = [];
    for await (const d of blogSearchSource().documents()) docs.push(d);
    expect(docs.find((d) => d.url === '/blog/first')?.body).toContain('Body of first');
    expect(docs.find((d) => d.url === '/blog/third')?.body).toBe('Members excerpt');
    expect(blogAdminResources().map((r) => [r.name, r.group])).toEqual([
      ['posts', 'Blog'], ['authors', 'Blog'], ['categories', 'Blog'], ['tags', 'Blog'], ['series', 'Blog'],
    ]);
  });
});
