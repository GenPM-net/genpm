import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { AdminContext } from '../contracts/index.ts';
import { testDb } from '../db/__fixtures__/pglite.ts';
import type { Db } from '../db/index.ts';
import * as jobsSchema from '../jobs/schema.ts';
import { runDue } from '../jobs/index.ts';
import { exitPreviewRoute, previewRoute } from './adapters/next.ts';
import * as schema from './schema.ts';
import {
  clearCollections,
  ContentError,
  contentAdminResource,
  contentEntries,
  contentSearchSource,
  contentSitemapSource,
  contentSource,
  countEntries,
  createEntry,
  createPreviewToken,
  defineCollection,
  defineSingleton,
  getEntry,
  getSingleton,
  listEntries,
  listRevisions,
  migrateEntries,
  publish,
  reader,
  restoreRevision,
  saveDraft,
  schedulePublish,
  seedEntry,
  slugify,
  unpublish,
  unschedule,
  verifyPreviewToken,
} from './index.ts';
// El job de publicación programada se registra al importar entries; clearCollections no lo borra.

let db: Db;
const Page = z.object({ title: z.string().min(1), body: z.string().default(''), category: z.string().optional(), seo: z.object({ noindex: z.boolean().optional() }).optional() });

beforeEach(async () => {
  db = await testDb(schema, jobsSchema);
  clearCollections();
  delete process.env.CONTENT_DEFAULT_LOCALE;
  process.env.CONTENT_PREVIEW_SECRET = 'p'.repeat(40);
  process.env.CRON_SECRET = 'c'.repeat(40);
});

const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return 'ok';
  } catch (e) {
    if (e instanceof ContentError) return e.code;
    throw e;
  }
};

describe('collections', () => {
  it('validates names, slugs and slugify', async () => {
    expect(() => defineCollection('Bad-Name', { schema: Page })).toThrow();
    defineCollection('pages', { schema: Page });
    expect(await code(createEntry({ collection: 'pages', slug: 'Bad Slug', data: {} }))).toBe('invalid_slug');
    expect(await code(createEntry({ collection: 'nope', slug: 'x', data: {} }))).toBe('unknown_collection');
    expect(slugify('  Hola, Mundo ñandú! ')).toBe('hola-mundo-nandu');
    expect(await code(createEntry({ collection: 'pages', slug: 'docs/intro', data: {} }))).toBe('ok');
    expect(await code(createEntry({ collection: 'pages', slug: 'docs/intro', data: {} }))).toBe('slug_taken');
  });

  it('infers admin fields from the schema', () => {
    const c = defineCollection('faqs', { schema: z.object({ title: z.string(), order: z.number().optional(), open: z.boolean() }) });
    expect(c.fields.map((f) => [f.name, f.type])).toEqual([['title', 'text'], ['order', 'number'], ['open', 'boolean']]);
    expect(c.titleField).toBe('title');
  });
});

describe('draft → publish lifecycle', () => {
  it('drafts are invisible, publishing validates fully, edits stay private until republished', async () => {
    defineCollection('pages', { schema: Page });
    const e = await createEntry({ collection: 'pages', slug: 'about', data: { body: 'wip' } });
    expect(await getEntry('pages', 'about')).toBeNull();
    expect((await getEntry('pages', 'about', { draft: true }))?.data).toEqual({ body: 'wip' });
    expect(await code(publish(e.id))).toBe('invalid_data'); // falta title
    await saveDraft(e.id, { title: 'About', body: 'v1' });
    await publish(e.id, { authorId: 'usr_1', message: 'first' });
    expect((await getEntry('pages', 'about'))?.data).toEqual({ title: 'About', body: 'v1' });
    await saveDraft(e.id, { title: 'About', body: 'v2' });
    expect((await getEntry('pages', 'about'))?.data.body).toBe('v1');
    expect((await getEntry('pages', 'about', { draft: true }))?.data.body).toBe('v2');
    await publish(e.id);
    expect((await getEntry('pages', 'about'))?.data.body).toBe('v2');
    const revs = await listRevisions(e.id);
    expect(revs.map((r) => r.data.body)).toEqual(['v2', 'v1']);
    await restoreRevision(revs[1]!.id);
    await publish(e.id);
    expect((await getEntry('pages', 'about'))?.data.body).toBe('v1');
    await unpublish(e.id);
    expect(await getEntry('pages', 'about')).toBeNull();
    expect((await getEntry('pages', 'about', { draft: true }))?.data.body).toBe('v1');
  });

  it('scheduled publishing runs through @core/jobs at the right time', async () => {
    defineCollection('pages', { schema: Page });
    const e = await createEntry({ collection: 'pages', slug: 'launch', data: { title: 'Launch' } });
    const at = new Date(Date.now() + 60_000);
    expect(await code(schedulePublish(e.id, new Date(Date.now() - 1)))).toBe('invalid_state');
    expect((await schedulePublish(e.id, at)).status).toBe('scheduled');
    expect((await runDue()).claimed).toBe(0);
    expect(await getEntry('pages', 'launch')).toBeNull();
    // El job se ejecuta a su hora (el handler comprueba la hora real, así que adelantamos scheduledAt).
    await db.update(contentEntries).set({ scheduledAt: new Date() }).where(eq(contentEntries.id, e.id));
    expect((await runDue({ now: new Date(at.getTime() + 1000) })).done).toBe(1);
    expect((await getEntry('pages', 'launch'))?.data.title).toBe('Launch');
  });

  it('a published entry stays live while changes are scheduled, and unschedule cancels', async () => {
    defineCollection('pages', { schema: Page });
    const e = await createEntry({ collection: 'pages', slug: 'home', data: { title: 'Old' } });
    await publish(e.id);
    await saveDraft(e.id, { title: 'New' });
    const s = await schedulePublish(e.id, new Date(Date.now() + 60_000));
    expect(s.status).toBe('published');
    expect((await getEntry('pages', 'home'))?.data.title).toBe('Old');
    await unschedule(e.id);
    await db.update(contentEntries).set({ updatedAt: new Date() });
    expect((await runDue({ now: new Date(Date.now() + 120_000) })).done).toBe(1); // el job no hace nada
    expect((await getEntry('pages', 'home'))?.data.title).toBe('Old');
  });
});

describe('locales and listing', () => {
  it('falls back to the default locale per entry and lists without duplicates', async () => {
    defineCollection('pages', { schema: Page });
    const en = await seedEntry({ collection: 'pages', slug: 'a', data: { title: 'A en', category: 'x' } });
    await seedEntry({ collection: 'pages', slug: 'b', data: { title: 'B en', category: 'y' } });
    const es = await createEntry({ collection: 'pages', slug: 'a', locale: 'es', data: { title: 'A es', category: 'x' }, translationOf: en.id });
    expect((await getEntry('pages', 'a', { locale: 'es' }))?.data.title).toBe('A en'); // traducción sin publicar
    await publish(es.id);
    expect((await getEntry('pages', 'a', { locale: 'es' }))?.data.title).toBe('A es');
    expect((await getEntry('pages', 'b', { locale: 'es' }))?.data.title).toBe('B en');
    const list = await listEntries<{ title: string }>('pages', { locale: 'es', orderBy: 'slug' });
    expect(list.map((e) => e.data.title)).toEqual(['A es', 'B en']);
    expect((await listEntries('pages', { where: { category: 'y' } })).map((e) => e.slug)).toEqual(['b']);
    expect(await countEntries('pages', { locale: 'es' })).toBe(2);
    expect(await countEntries('pages', { where: { category: 'y' } })).toBe(1);
    expect((await listEntries('pages', { orderBy: '-title', limit: 1 })).map((e) => e.slug)).toEqual(['b']);
    expect((await listEntries('pages', { orderBy: 'title', offset: 1 })).map((e) => e.slug)).toEqual(['b']);
    await expect(listEntries('pages', { orderBy: 'x; drop table' })).rejects.toThrow();
    expect((await contentSource.listEntries('pages')).length).toBe(2);
  });

  it('singletons and typed readers; seedEntry never overwrites editor changes', async () => {
    const home = defineSingleton('home', { schema: z.object({ heroTitle: z.string(), cta: z.string() }) });
    const s = await seedEntry({ collection: 'home', data: { heroTitle: 'Welcome', cta: 'Buy' } });
    expect(s.slug).toBe('_');
    await saveDraft(s.id, { heroTitle: 'Edited', cta: 'Buy' });
    await publish(s.id);
    await seedEntry({ collection: 'home', data: { heroTitle: 'Welcome', cta: 'Buy' } });
    const typed = await reader(home).singleton();
    expect(typed?.data.heroTitle).toBe('Edited');
    expect((await getSingleton('home'))?.data.cta).toBe('Buy');
  });

  it('filters list fields with contains', async () => {
    defineCollection('notes', { schema: z.object({ title: z.string(), tags: z.array(z.string()).default([]) }) });
    await seedEntry({ collection: 'notes', slug: 'a', data: { title: 'A', tags: ['news', 'mugs'] } });
    await seedEntry({ collection: 'notes', slug: 'b', data: { title: 'B', tags: ['mugs'] } });
    expect((await listEntries('notes', { contains: { tags: 'news' } })).map((e) => e.slug)).toEqual(['a']);
    expect(await countEntries('notes', { contains: { tags: 'mugs' } })).toBe(2);
    expect(await countEntries('notes', { contains: { tags: "x' or 1=1 --" } })).toBe(0);
  });

  it('migrateEntries rewrites data and drafts and validates them', async () => {
    defineCollection('pages', { schema: Page });
    for (let i = 0; i < 3; i++) await seedEntry({ collection: 'pages', slug: `p${i}`, data: { title: `T${i}` } });
    defineCollection('pages', { schema: Page.extend({ subtitle: z.string() }) });
    expect(await migrateEntries('pages', (d) => ({ ...d, subtitle: String(d.title).toLowerCase() }))).toBe(3);
    expect((await getEntry('pages', 'p1'))?.data.subtitle).toBe('t1');
    await expect(migrateEntries('pages', (d) => ({ ...d, subtitle: 1 }))).rejects.toThrow();
  });
});

describe('preview tokens and Next adapter', () => {
  it('signs entry and path, rejects tampering, expiry and external paths', async () => {
    const t = await createPreviewToken('ent_1', '/about');
    expect(await verifyPreviewToken(t)).toMatchObject({ entryId: 'ent_1', path: '/about' });
    expect(await code(verifyPreviewToken(`${t}x`))).toBe('invalid_token');
    expect(await code(verifyPreviewToken(await createPreviewToken('e', '/x', { ttlSeconds: -1 })))).toBe('invalid_token');
    for (const bad of ['//evil.com', 'https://evil.com', '/\\evil.com', 'about']) expect(await code(createPreviewToken('e', bad))).toBe('invalid_state');
  });

  it('enables draft mode and redirects only to the signed path', async () => {
    const state = { enabled: false };
    const draftMode = async () => ({ enable: () => void (state.enabled = true), disable: () => void (state.enabled = false) });
    const t = await createPreviewToken('ent_1', '/blog/x');
    const res = await previewRoute(draftMode)(new Request(`http://site/api/preview?token=${t}`));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('/blog/x');
    expect(state.enabled).toBe(true);
    expect((await previewRoute(draftMode)(new Request('http://site/api/preview?token=bad'))).status).toBe(401);
    const out = await exitPreviewRoute(draftMode)(new Request('http://site/api/exit-preview?path=//evil.com'));
    expect(out.headers.get('location')).toBe('/');
    expect(state.enabled).toBe(false);
  });

  it('exit-preview rejects paths that browsers turn into another origin (tabs, newlines, control chars)', async () => {
    const draftMode = async () => ({ enable: () => {}, disable: () => {} });
    for (const bad of ['/\t/evil.com', '/%09/evil.com', '/\n/evil.com', '/\r/evil.com', '/\u0001/evil.com', '/ /evil.com']) {
      const url = new URL('http://site/api/exit-preview');
      url.searchParams.set('path', bad.startsWith('/%') ? decodeURIComponent(bad) : bad);
      const out = await exitPreviewRoute(draftMode)(new Request(url));
      expect(out.headers.get('location'), JSON.stringify(bad)).toBe('/');
    }
    const ok = await exitPreviewRoute(draftMode)(new Request('http://site/api/exit-preview?path=/blog/x%3Fa%3D1'));
    expect(ok.headers.get('location')).toBe('/blog/x?a=1');
    for (const bad of ['/\t/evil.com', '/\u0000x']) expect(await code(createPreviewToken('e', bad))).toBe('invalid_state');
  });

  it('draft mode expires with the preview token when cookies are passed', async () => {
    const jar = new Map<string, Record<string, unknown>>();
    const cookies = async () => ({
      get: (name: string) => (jar.has(name) ? { value: String(jar.get(name)!.value) } : undefined),
      set: (c: { name: string; value: string }) => void jar.set(c.name, c),
    });
    // Imita a Next 15: `enable()` escribe la cookie de sesión sin caducidad.
    const draftMode = async () => ({
      enable: () => void jar.set('__prerender_bypass', { name: '__prerender_bypass', value: 'preview-id', httpOnly: true, sameSite: 'none', secure: true, path: '/' }),
      disable: () => {},
    });
    const t = await createPreviewToken('ent_1', '/blog/x', { ttlSeconds: 600 });
    const res = await previewRoute(draftMode, cookies)(new Request(`http://site/api/preview?token=${t}`));
    expect(res.status).toBe(307);
    const c = jar.get('__prerender_bypass')!;
    expect(c).toMatchObject({ value: 'preview-id', httpOnly: true, path: '/', sameSite: 'none', secure: true });
    expect(c.maxAge).toBeGreaterThan(590);
    expect(c.maxAge).toBeLessThanOrEqual(600);
  });
});

describe('sources', () => {
  it('sitemap with hreflang alternates and search documents, published only', async () => {
    defineCollection('pages', { schema: Page });
    const en = await seedEntry({ collection: 'pages', slug: 'about', data: { title: 'About', body: 'We sell mugs' } });
    const es = await createEntry({ collection: 'pages', slug: 'sobre', locale: 'es', data: { title: 'Sobre', body: 'Tazas' }, translationOf: en.id });
    await publish(es.id);
    await createEntry({ collection: 'pages', slug: 'secret', data: { title: 'Draft' } });
    // Publicada pero con `seo.noindex`: no va al sitemap (sí al buscador interno).
    await seedEntry({ collection: 'pages', slug: 'privacy', data: { title: 'Privacy', seo: { noindex: true } } });
    const path = ({ slug, locale }: { slug: string; locale: string }) => (locale === 'en' ? `/${slug}` : `/${locale}/${slug}`);
    const urls = [];
    for await (const u of contentSitemapSource('pages', path).urls()) urls.push(u);
    expect(urls.map((u) => u.loc).sort()).toEqual(['/about', '/es/sobre']);
    expect(urls[0]!.alternates).toEqual({ en: '/about', es: '/es/sobre' });
    const docs = [];
    for await (const d of contentSearchSource('pages', { path }).documents()) docs.push(d);
    expect(docs.find((d) => d.url === '/about')).toMatchObject({ title: 'About', type: 'pages' });
    expect(docs.find((d) => d.url === '/about')!.body).toContain('We sell mugs');
  });
});

describe('admin resource', () => {
  const ctxFor = (userId: string, perms: string[]): AdminContext => ({
    user: { id: userId, email: null, name: null },
    can: async (p) => perms.includes(p),
  });

  it('CRUD and publish actions behind collection permissions; authors only touch their own', async () => {
    defineCollection('posts', { schema: Page });
    const r = contentAdminResource('posts');
    const editor = ctxFor('usr_ed', ['posts:read', 'posts:create', 'posts:update', 'posts:publish', 'posts:delete']);
    const author = ctxFor('usr_au', ['posts:create', 'posts:read:own', 'posts:update:own']);
    const mine = await r.create!({ slug: 'mine', data: { title: 'Mine' } }, author);
    const theirs = await r.create!({ slug: 'theirs', data: { title: 'Theirs' } }, editor);
    expect(r.title(mine)).toBe('Mine');
    expect((await r.list({ page: 1, pageSize: 10 }, author)).rows.map((x) => x.slug)).toEqual(['mine']);
    expect((await r.list({ page: 1, pageSize: 10 }, editor)).total).toBe(2);
    expect((await r.list({ page: 1, pageSize: 10, search: 'thei' }, editor)).rows.map((x) => x.slug)).toEqual(['theirs']);
    expect(await code(r.update!(theirs.id, { data: { title: 'Hacked' } }, author))).toBe('forbidden');
    expect((await r.update!(mine.id, { slug: 'mine-2', data: { title: 'Mine 2' } }, author)).slug).toBe('mine-2');
    const publishAction = r.actions!.find((a) => a.name === 'publish')!;
    expect(await code(publishAction.run(mine.id, {}, author))).toBe('forbidden');
    expect((await publishAction.run(mine.id, {}, editor)).status).toBe('published');
    expect((await getEntry('posts', 'mine-2'))?.data.title).toBe('Mine 2');
    const scheduleAction = r.actions!.find((a) => a.name === 'schedule')!;
    expect((await scheduleAction.run(theirs.id, { at: new Date(Date.now() + 3_600_000).toISOString() }, editor)).status).toBe('scheduled');
    expect(await code(r.delete!(theirs.id, author))).toBe('forbidden');
    await r.delete!(theirs.id, editor);
    expect(await r.get(theirs.id, editor)).toBeNull();
  });

  it('update is atomic: invalid data does not leave the entry renamed', async () => {
    defineCollection('posts', { schema: Page });
    const r = contentAdminResource('posts');
    const editor = ctxFor('usr_ed', ['posts:read', 'posts:create', 'posts:update']);
    const row = await r.create!({ slug: 'keep', data: { title: 'Keep' } }, editor);
    expect(await code(r.update!(row.id, { slug: 'renamed', data: { title: 123 } }, editor))).toBe('invalid_data');
    expect((await r.get(row.id, editor))?.slug).toBe('keep');
    await r.create!({ slug: 'taken', data: { title: 'Taken' } }, editor);
    expect(await code(r.update!(row.id, { slug: 'taken', data: { title: 'X' } }, editor))).toBe('slug_taken');
    expect((await r.get(row.id, editor))?.data.title).toBe('Keep');
  });

  it('links each entry to its public page and a short-lived signed preview', async () => {
    defineCollection('posts', { schema: Page });
    const r = contentAdminResource('posts', { path: (e) => `/blog/${e.slug}` });
    const editor = ctxFor('usr_ed', ['posts:read', 'posts:create', 'posts:publish']);
    const row = await r.create!({ slug: 'hello', data: { title: 'Hello' } }, editor);
    const draftLinks = await r.links!(row, editor);
    expect(draftLinks.map((l) => l.label)).toEqual(['Preview']);
    const token = new URL(draftLinks[0]!.href, 'https://x.test').searchParams.get('token');
    expect(await verifyPreviewToken(token)).toMatchObject({ entryId: row.id, path: '/blog/hello' });
    const published = await r.actions!.find((a) => a.name === 'publish')!.run(row.id, {}, editor);
    expect((await r.links!(published, editor)).map((l) => l.href)[0]).toBe('/blog/hello');
    expect(contentAdminResource('posts').links).toBeUndefined();
  });
});
