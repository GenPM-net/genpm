import type { ReactElement } from 'react';
import { renderToReadableStream } from 'react-dom/server';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Fuera de una petición de Next no hay draftMode()/cookies(): se simulan.
const state = vi.hoisted(() => ({ draft: false, cookie: '' }));
vi.mock('next/headers', () => ({
  draftMode: async () => ({ isEnabled: state.draft, enable() {}, disable() {} }),
  cookies: async () => ({ get: (name: string) => (state.cookie.startsWith(`${name}=`) ? { value: state.cookie.slice(name.length + 1) } : undefined) }),
}));

import { admin, pages } from '@/genpm';
import * as adminSchema from '@/lib/admin/schema';
import * as antispamSchema from '@/lib/antispam/schema';
import { createSession, generateSessionToken, SESSION_COOKIE, upsertOAuthUser } from '@/lib/auth';
import * as authSchema from '@/lib/auth/schema';
import { createEntry, publish, seedEntry } from '@/lib/content';
import * as contentSchema from '@/lib/content/schema';
import { testDb } from '@/lib/db/__fixtures__/pglite';
import * as formsSchema from '@/lib/forms/schema';
import * as jobsSchema from '@/lib/jobs/schema';
import * as mediaSchema from '@/lib/media/schema';
import { bootstrapOwner } from '@/lib/rbac';
import * as rbacSchema from '@/lib/rbac/schema';
import { reindex } from '@/lib/search';
import * as searchSchema from '@/lib/search/schema';
import { invalidateRedirectCache, upsertRedirect } from '@/lib/site';
import * as siteSchema from '@/lib/site/schema';
import CatchAll, { generateMetadata } from './[...slug]/page';
import AdminPage from './admin/[[...path]]/page';
import { createOwner } from './_scripts/create-owner';
import { GET as adminApi } from './api/admin/[...path]/route';
import { GET as llms } from './llms.txt/route';
import { GET as robots } from './robots.txt/route';
import { GET as sitemap } from './sitemap.xml/route';
import SearchPage from './search/page';

/** Render completo esperando a los componentes async (como `<Form>`), igual que el streaming de Next. */
const html = async (node: Promise<unknown> | unknown) => {
  const stream = await renderToReadableStream((await node) as ReactElement);
  await stream.allReady;
  return new Response(stream).text();
};
/** Errores de control de Next (`notFound`, `redirect`): devuelve su `digest`. */
async function digest(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'none';
  } catch (e) {
    const d = (e as { digest?: string }).digest;
    if (!d) throw e;
    return d.split(';').slice(0, 3).join(';');
  }
}

beforeAll(() => {
  Object.assign(process.env, { AUTH_SECRET: 'a'.repeat(40), CONTENT_PREVIEW_SECRET: 'p'.repeat(40), SITE_URL: 'https://site.test', ANTISPAM_SECRET: 's'.repeat(40) });
});

beforeEach(async () => {
  state.draft = false;
  state.cookie = '';
  invalidateRedirectCache();
  await testDb(authSchema, rbacSchema, contentSchema, mediaSchema, formsSchema, antispamSchema, jobsSchema, searchSchema, siteSchema, adminSchema);
  await seedEntry({ collection: 'site_settings', data: { name: 'Acme', tagline: 'Mugs for everyone' } });
  const about = await createEntry({
    collection: 'pages',
    slug: 'about',
    data: {
      title: 'About us',
      blocks: [
        { id: 'h', type: 'hero', data: { title: 'We make mugs' } },
        { id: 'f', type: 'form', data: { title: 'Write to us', formKey: 'contact' } },
      ],
      seo: { description: 'The mug company' },
    },
  });
  await publish(about.id);
  await createEntry({ collection: 'pages', slug: 'draft-page', data: { title: 'Secret', blocks: [] } });
});

describe('registration (src/genpm)', () => {
  it('registers the pages collection and the admin resources of every CMS package', () => {
    expect(pages.name).toBe('pages');
    // El proyecto de ejemplo incluye además los recursos de otros kits (blog…).
    expect(admin.resources.map((r) => r.name)).toEqual(expect.arrayContaining(['pages', 'media', 'submissions', 'forms', 'site_settings', 'menus', 'redirects', 'users', 'admin-audit']));
  });
});

describe('public pages', () => {
  const props = (slug: string[]) => ({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) });

  it('renders a published page with its blocks, one h1, the contact form and metadata', async () => {
    const out = await html(CatchAll(props(['about'])));
    expect(out.match(/<h1/g)).toHaveLength(1);
    expect(out).toContain('We make mugs');
    expect(out).toContain('action="/api/forms/contact"');
    const meta = await generateMetadata(props(['about']));
    expect(meta.title).toBe('About us · Acme');
    expect(meta.description).toBe('The mug company');
    expect(meta.alternates?.canonical).toBe('https://site.test/about');
  });

  it('shows drafts only in draft mode, and never indexed', async () => {
    expect(await digest(CatchAll(props(['draft-page'])))).toBe('NEXT_HTTP_ERROR_FALLBACK;404');
    state.draft = true;
    expect(await html(CatchAll(props(['draft-page'])))).toBe('');
    expect((await generateMetadata(props(['draft-page']))).robots).toMatchObject({ index: false });
  });

  it('applies redirects managed in the admin before the 404', async () => {
    await upsertRedirect({ from: '/old-about', to: '/about', status: 301 });
    expect(await digest(CatchAll(props(['old-about'])))).toBe('NEXT_REDIRECT;replace;/about');
    expect(await digest(CatchAll(props(['nope'])))).toBe('NEXT_HTTP_ERROR_FALLBACK;404');
    expect(await digest(CatchAll(props(['home'])))).toBe('NEXT_HTTP_ERROR_FALLBACK;404'); // la portada vive en `/`
  });
});

describe('SEO and search routes', () => {
  it('serves robots, sitemap and llms.txt from published pages', async () => {
    expect(await (await robots()).text()).toContain('Disallow: /admin');
    const index = await (await sitemap()).text();
    expect(index).toContain('https://site.test/sitemaps/pages/');
    const txt = await (await llms()).text();
    expect(txt).toContain('# Acme');
    expect(txt).toContain('[About us](https://site.test/about): The mug company');
    expect(txt).not.toContain('Secret');
  });

  it('finds pages by the text of their blocks', async () => {
    await reindex();
    const out = await html(SearchPage({ searchParams: Promise.resolve({ q: 'mugs' }) }));
    expect(out).toContain('href="/about"');
    expect(out).toContain('<mark>');
  });
});

describe('admin', () => {
  it('sends visitors to the login page and keeps the API closed', async () => {
    expect(await digest(AdminPage({ params: Promise.resolve({}) }))).toBe('NEXT_REDIRECT;replace;/admin/login');
    expect((await adminApi(new Request('https://site.test/api/admin/schema'))).status).toBe(401);
  });

  it('creates the first owner by email and opens the panel', async () => {
    expect(await createOwner('ana@acme.test')).toBe('no_user');
    const user = await upsertOAuthUser('github', { id: '1', email: 'ana@acme.test', emailVerified: true, name: 'Ana', avatarUrl: null });
    const token = generateSessionToken();
    await createSession(token, user.id);
    state.cookie = `${SESSION_COOKIE}=${token}`;
    expect(await html(AdminPage({ params: Promise.resolve({}) }))).toContain('No access');
    expect(await createOwner(' Ana@Acme.test ')).toBe('created');
    expect(await createOwner('ana@acme.test')).toBe('exists');
    expect(await digest(AdminPage({ params: Promise.resolve({ path: ['pages'] }) }))).toBe('none');
    const res = await adminApi(new Request('https://site.test/api/admin/pages', { headers: { cookie: state.cookie } }));
    expect(((await res.json()) as { total: number }).total).toBe(2);
    expect(await bootstrapOwner(user.id)).toBe(false);
  });
});
