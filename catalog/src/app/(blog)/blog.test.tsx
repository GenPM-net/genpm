import type { ReactElement } from 'react';
import { renderToReadableStream } from 'react-dom/server';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ draft: false }));
vi.mock('next/headers', () => ({
  draftMode: async () => ({ isEnabled: state.draft, enable() {}, disable() {} }),
  cookies: async () => ({ get: () => undefined }),
}));

import { admin, blocks } from '@/genpm';
import * as adminSchema from '@/lib/admin/schema';
import * as antispamSchema from '@/lib/antispam/schema';
import { formTimingToken } from '@/lib/antispam';
import * as authSchema from '@/lib/auth/schema';
import { RenderBlocks } from '@/lib/blocks';
import * as commentsSchema from '@/lib/comments/schema';
import { comments } from '@/lib/comments';
import { createEntry, publish, schedulePublish, seedEntry } from '@/lib/content';
import * as contentSchema from '@/lib/content/schema';
import { testDb } from '@/lib/db/__fixtures__/pglite';
import * as formsSchema from '@/lib/forms/schema';
import * as jobsSchema from '@/lib/jobs/schema';
import * as mediaSchema from '@/lib/media/schema';
import { campaigns } from '@/lib/newsletter';
import * as newsletterSchema from '@/lib/newsletter/schema';
import * as rbacSchema from '@/lib/rbac/schema';
import { docFromText } from '@/lib/rich-text';
import * as searchSchema from '@/lib/search/schema';
import { sitemapChunkXml } from '@/lib/seo';
import * as siteSchema from '@/lib/site/schema';
import { POST as postCommentRoute } from './api/comments/[type]/[id]/route';
import CategoryPage from './blog/category/[slug]/page';
import { GET as rss } from './blog/feed.xml/route';
import BlogIndex from './blog/page';
import PostPage, { generateMetadata as postMetadata } from './blog/[slug]/page';
import MonthArchive from './blog/archive/[year]/[month]/page';
import { POST as subscribeRoute } from './newsletter/subscribe/route';

const html = async (node: Promise<unknown> | unknown) => {
  const stream = await renderToReadableStream((await node) as ReactElement);
  await stream.allReady;
  return new Response(stream).text();
};
async function digest(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'none';
  } catch (e) {
    const d = (e as { digest?: string }).digest;
    if (!d) throw e;
    return d.split(';').slice(0, 2).join(';');
  }
}
const sp = (o: Record<string, string> = {}) => Promise.resolve(o);
const params = <T,>(p: T) => Promise.resolve(p);
let db: Awaited<ReturnType<typeof testDb>>;
let helloId: string;

async function post(slug: string, data: Record<string, unknown>, opts: { publishAt?: Date | 'never' } = {}) {
  const e = await createEntry({ collection: 'posts', slug, data: { body: docFromText(`Body of ${slug}`), ...data } });
  if (opts.publishAt === 'never') return e;
  if (opts.publishAt) return schedulePublish(e.id, opts.publishAt);
  return publish(e.id);
}

beforeAll(() => {
  Object.assign(process.env, { AUTH_SECRET: 'a'.repeat(40), CONTENT_PREVIEW_SECRET: 'p'.repeat(40), SITE_URL: 'https://site.test', ANTISPAM_SECRET: 's'.repeat(40), NEWSLETTER_SECRET: 'n'.repeat(40) });
});

beforeEach(async () => {
  state.draft = false;
  db = await testDb(authSchema, rbacSchema, contentSchema, mediaSchema, formsSchema, antispamSchema, jobsSchema, searchSchema, siteSchema, adminSchema, commentsSchema, newsletterSchema);
  await seedEntry({ collection: 'site_settings', data: { name: 'Acme', tagline: 'Mugs' } });
  for (const [c, slug, name] of [['authors', 'ana', 'Ana'], ['categories', 'news', 'News'], ['tags', 'mugs', 'Mugs'], ['tags', 'tea', 'Tea']] as const)
    await publish((await createEntry({ collection: c, slug, data: { name } })).id);
  helloId = (await post('hello', { title: 'Hello world', authors: ['ana'], categories: ['news'], tags: ['mugs', 'tea'], excerpt: 'First post' })).id;
  await post('second', { title: 'Second post', categories: ['news'], tags: ['mugs'], featured: true });
  await post('members', { title: 'For members', membersOnly: true, excerpt: 'Teaser only' });
  await post('future', { title: 'Future post' }, { publishAt: new Date(Date.now() + 86_400_000) });
});

describe('blog pages', () => {
  it('lists published posts with featured first, never scheduled ones', async () => {
    const out = await html(BlogIndex({ searchParams: sp() }));
    const titles = [...out.matchAll(/<h2><a href="\/blog\/([\w-]+)"/g)].map((m) => m[1]);
    expect(titles[0]).toBe('second');
    expect(titles.sort()).toEqual(['hello', 'members', 'second']);
    expect(out).toContain('href="/blog/feed.xml"');
  });

  it('renders a post with authors, tags, related posts, share links, comments and JSON-LD', async () => {
    await db.insert(comments).values({ entityType: 'post', entityId: helloId, authorName: 'Bea', body: 'Nice post!', status: 'approved' });
    const out = await html(PostPage({ params: params({ slug: 'hello' }), searchParams: sp({ comment: 'pending' }) }));
    expect(out.match(/<h1/g)).toHaveLength(1);
    expect(out).toContain('href="/blog/author/ana">Ana</a>');
    expect(out).toContain('href="/blog/tag/tea">Tea</a>');
    expect(out).toContain('Body of hello');
    expect(out).toContain('href="/blog/second"'); // relacionado por etiqueta y categoría
    expect(out).toContain('https://x.com/intent/post?url=https%3A%2F%2Fsite.test%2Fblog%2Fhello');
    expect(out).toContain(`action="/api/comments/post/${helloId}"`);
    expect(out).toContain('will appear after moderation');
    expect(out).toContain('Nice post!');
    expect(out).toContain('action="/newsletter/subscribe"');
    const ld = JSON.parse(out.match(/<script type="application\/ld\+json">(.*?)<\/script>/)![1]!);
    expect(ld).toMatchObject({ '@type': 'BlogPosting', headline: 'Hello world', author: { name: 'Ana' }, publisher: { name: 'Acme' } });
    const meta = await postMetadata({ params: params({ slug: 'hello' }), searchParams: sp() });
    expect(meta.title).toBe('Hello world · Acme');
    expect(meta.description).toBe('First post');
  });

  it('hides members-only bodies and 404s drafts and scheduled posts outside preview', async () => {
    const members = await html(PostPage({ params: params({ slug: 'members' }), searchParams: sp() }));
    expect(members).toContain('Teaser only');
    expect(members).not.toContain('Body of members');
    expect(await digest(PostPage({ params: params({ slug: 'future' }), searchParams: sp() }))).toBe('NEXT_HTTP_ERROR_FALLBACK;404');
    state.draft = true;
    expect(await html(PostPage({ params: params({ slug: 'future' }), searchParams: sp() }))).toContain('Future post');
    expect((await postMetadata({ params: params({ slug: 'future' }), searchParams: sp() })).robots).toMatchObject({ index: false });
  });

  it('serves category and month archives', async () => {
    const cat = await html(CategoryPage({ params: params({ slug: 'news' }), searchParams: sp() }));
    expect(cat).toContain('Category: News');
    expect(cat).toContain('href="/blog/hello"');
    expect(cat).not.toContain('href="/blog/members"');
    expect(await digest(CategoryPage({ params: params({ slug: 'nope' }), searchParams: sp() }))).toBe('NEXT_HTTP_ERROR_FALLBACK;404');
    const now = new Date();
    const month = await html(MonthArchive({ params: params({ year: String(now.getUTCFullYear()), month: String(now.getUTCMonth() + 1) }) }));
    expect(month).toContain('href="/blog/hello"');
    expect(await digest(MonthArchive({ params: params({ year: '2026', month: '13' }) }))).toBe('NEXT_HTTP_ERROR_FALLBACK;404');
  });
});

describe('feeds, sitemap and the latest posts block', () => {
  it('feeds and sitemap include published posts only', async () => {
    const xml = await (await rss()).text();
    expect(xml).toContain('<title>Hello world</title>');
    expect(xml).not.toContain('Future post');
    const sitemap = await sitemapChunkXml('posts', 0);
    expect(sitemap).toContain('https://site.test/blog/hello');
    expect(sitemap).not.toContain('future');
  });

  it('renders the latest posts block inside CMS pages', async () => {
    const out = await html(<RenderBlocks blocks={[{ id: 'l', type: 'latest-posts', data: { title: 'From the blog', count: 2 } }]} registry={blocks} />);
    expect(out).toContain('From the blog');
    expect(out.match(/<h3><a href="\/blog\//g)).toHaveLength(2);
  });
});

describe('forms without JavaScript', () => {
  const human = async (o: Record<string, string>) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries({ ...o, _ts: await formTimingToken(Date.now() - 5000), website: '' })) fd.set(k, v);
    return fd;
  };
  const htmlPost = (url: string, body: FormData, ip: string) =>
    new Request(url, { method: 'POST', body, headers: { accept: 'text/html', referer: 'https://site.test/blog/hello', 'x-forwarded-for': ip } });

  it('posts a guest comment into moderation and only accepts the post type', async () => {
    const ctx = (type: string) => ({ params: Promise.resolve({ type, id: helloId }) });
    const res = await postCommentRoute(htmlPost(`https://site.test/api/comments/post/${helloId}`, await human({ body: 'Great read', name: 'Guest', email: 'g@x.test' }), '198.51.100.1'), ctx('post'));
    expect(res.headers.get('location')).toBe('https://site.test/blog/hello?comment=pending#comments');
    expect((await postCommentRoute(htmlPost('https://site.test/api/comments/product/x', await human({ body: 'x' }), '198.51.100.2'), ctx('product'))).status).toBe(404);
  });

  it('subscribes to the newsletter with double opt-in', async () => {
    const res = await subscribeRoute(htmlPost('https://site.test/newsletter/subscribe', await human({ email: 'reader@x.test' }), '198.51.100.3'));
    expect(res.headers.get('location')).toBe('https://site.test/blog/hello?newsletter=pending#newsletter');
  });
});

describe('admin', () => {
  it('registers blog resources and turns a published post into a draft campaign', async () => {
    const names = admin.resources.map((r) => r.name);
    expect(names).toEqual(expect.arrayContaining(['posts', 'authors', 'categories', 'tags', 'series', 'comments', 'subscribers', 'campaigns']));
    const postsRes = admin.resources.find((r) => r.name === 'posts')!;
    const ctx = { user: { id: 'usr_1', email: null, name: null }, can: async () => true };
    const action = postsRes.actions!.find((a) => a.name === 'send-as-campaign')!;
    await action.run(helloId, {}, ctx);
    const [c] = await db.select().from(campaigns);
    expect(c).toMatchObject({ subject: 'Hello world', preheader: 'First post', status: 'draft' });
    expect((await postsRes.links!((await postsRes.get(helloId, ctx))!, ctx)).map((l) => l.href)[0]).toBe('/blog/hello');
  });
});
