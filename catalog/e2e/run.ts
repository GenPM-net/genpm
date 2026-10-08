// E2E del proyecto de ejemplo con un Postgres REAL y el build de producción de Next (`next build` + `next start`):
// el recorrido de quien edita (login → crear página con bloques → publicar → verla) y de quien visita.
// Uso: DATABASE_URL=postgres://…/vacia pnpm e2e   (la base de datos se vacía y migra al empezar).
// Chromium: PLAYWRIGHT_CHROMIUM (ruta del ejecutable) o el de playwright-core.
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import postgres from 'postgres';
import { chromium, type Page } from 'playwright-core';
import { migrationStatements } from '../scripts/all-schemas.ts';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required (an empty database: it is wiped)');
const port = Number(process.env.E2E_PORT ?? 3100);
const base = `http://localhost:${port}`;
const env = {
  ...process.env,
  DATABASE_URL: url,
  SITE_URL: base,
  AUTH_SECRET: 'e2e-auth-secret-'.padEnd(40, 'x'),
  GITHUB_CLIENT_ID: 'e2e',
  GITHUB_CLIENT_SECRET: 'e2e',
  CONTENT_PREVIEW_SECRET: 'e2e-preview-secret-'.padEnd(40, 'x'),
  ANTISPAM_SECRET: 'e2e-antispam-secret-'.padEnd(40, 'x'),
  CRON_SECRET: 'e2e-cron-secret-'.padEnd(40, 'x'),
  STORAGE_DRIVER: 'memory',
  STORAGE_SECRET: 'e2e-storage-secret-'.padEnd(40, 'x'),
  STORAGE_PUBLIC_URL: base,
  EMAIL_FROM: 'Site <site@example.test>',
  CONSENT_POLICY_VERSION: '2026-10',
  GA4_MEASUREMENT_ID: 'G-E2ETEST000',
  META_PIXEL_ID: '1234567890',
  NEWSLETTER_SECRET: 'e2e-newsletter-secret-'.padEnd(40, 'x'),
  NEWSLETTER_FROM: 'News <news@example.test>',
  NEWSLETTER_POSTAL_ADDRESS: 'Calle Sol 4, Valencia',
  NODE_ENV: 'production' as const,
};
Object.assign(process.env, env);

/** Lighthouse CLI (móvil por defecto) con el Chromium de Playwright; devuelve las puntuaciones 0–100. */
function lighthouse(target: string): Record<string, number> {
  const out = `${process.env.TMPDIR ?? '/tmp'}/genpm-lh-${Date.now()}.json`;
  execFileSync(
    process.execPath,
    [require.resolve('lighthouse/cli/index.js'), target, '--quiet', '--output=json', `--output-path=${out}`, '--only-categories=performance,accessibility,best-practices,seo', '--chrome-flags=--headless=new --no-sandbox'],
    { env: { ...process.env, CHROME_PATH: process.env.PLAYWRIGHT_CHROMIUM ?? chromium.executablePath() }, stdio: 'ignore' },
  );
  if (process.env.E2E_KEEP_LIGHTHOUSE) console.log(`  report: ${out}`);
  const r = JSON.parse(readFileSync(out, 'utf8')) as { categories: Record<string, { score: number }> };
  return Object.fromEntries(Object.entries(r.categories).map(([k, v]) => [k, Math.round(v.score * 100)]));
}

const step = async (name: string, fn: () => Promise<void>) => {
  const t = Date.now();
  await fn();
  console.log(`✔ ${name} (${Date.now() - t} ms)`);
};
const expect = (ok: unknown, msg: string) => {
  if (!ok) throw new Error(msg);
};

// 1. Base de datos vacía y migrada (todas las tablas de todos los módulos, como un proyecto con todos los kits).
const sql = postgres(url, { max: 1, onnotice: () => {} });
await sql.unsafe('drop schema public cascade; create schema public; create extension if not exists pg_trgm;');
const { statements } = await migrationStatements();
for (const s of statements) await sql.unsafe(s);
await sql.end();

// 2. La persona que instala: un usuario (como tras su primer login con GitHub), owner, con sesión.
const { createSession, generateSessionToken, SESSION_COOKIE, upsertOAuthUser } = await import('../src/lib/auth/index.ts');
const { bootstrapOwner } = await import('../src/lib/rbac/index.ts');
await import('../src/genpm/index.ts');
const { seedEntry } = await import('../src/lib/content/index.ts');
const owner = await upsertOAuthUser('github', { id: '1', email: 'owner@example.test', emailVerified: true, name: 'Owner', avatarUrl: null });
expect(await bootstrapOwner(owner.id), 'owner not created');
const token = generateSessionToken();
await createSession(token, owner.id);
await seedEntry({ collection: 'site_settings', data: { name: 'E2E Mugs', tagline: 'Mugs for everyone' } });
// Contenido de los kits: una landing (hero + formulario) y un post del blog, publicados.
const { createEntry, publish } = await import('../src/lib/content/index.ts');
const { docFromText } = await import('../src/lib/rich-text/index.ts');
await publish(
  (
    await createEntry({
      collection: 'landings',
      slug: 'promo',
      data: {
        title: 'Promo',
        blocks: [
          { id: 'h', type: 'hero', data: { title: 'The mug that keeps coffee hot for 6 hours', subtitle: 'Free shipping this week.' } },
          { id: 'f', type: 'form', data: { title: 'Get 10% off', formKey: 'contact' } },
        ],
      },
    })
  ).id,
);
await publish((await createEntry({ collection: 'authors', slug: 'ana', data: { name: 'Ana' } })).id);
await publish(
  (await createEntry({ collection: 'posts', slug: 'hello', data: { title: 'Hello world', excerpt: 'First post', authors: ['ana'], body: docFromText('Body of the first post.') } })).id,
);

// Tareas diarias de todos los kits del proyecto de ejemplo (lo que ejecuta la persona tras migrar).
const { setupSchedules } = await import('../src/app/(cms)/_scripts/setup-schedules.ts');
const scheduled = await setupSchedules();
for (const t of ['cms.maintenance', 'search.reindex', 'store.maintenance', 'experiments.prune'])
  expect(scheduled.includes(t), `${t} not scheduled (got ${scheduled.join(', ')})`);

// 3. Servidor de producción.
const require = createRequire(import.meta.url);
const nextBin = require.resolve('next/dist/bin/next');
const server: ChildProcess = spawn(process.execPath, [nextBin, 'start', '-p', String(port)], { env, stdio: ['ignore', 'pipe', 'pipe'] });
let log = '';
server.stdout!.on('data', (d) => (log += d));
server.stderr!.on('data', (d) => (log += d));
const stop = () => server.kill('SIGTERM');
process.on('exit', stop);
for (let i = 0; ; i++) {
  try {
    if ((await fetch(`${base}/robots.txt`)).ok) break;
  } catch {}
  if (i > 120) throw new Error(`next start did not come up:\n${log}`);
  await new Promise((r) => setTimeout(r, 500));
}

const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {});
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
async function axe(page: Page): Promise<string[]> {
  await page.addScriptTag({ content: axeSource });
  const r = await page.evaluate(async () => {
    const res = await (window as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<{ violations: Array<{ id: string; nodes: unknown[] }> }> } }).axe.run(document, {
      rules: { 'color-contrast': { enabled: false } },
    });
    return res.violations.map((v) => `${v.id} (${v.nodes.length})`);
  });
  return r;
}

try {
  const visitor = await (await browser.newContext()).newPage();
  const editorCtx = await browser.newContext();
  await editorCtx.addCookies([{ name: SESSION_COOKIE, value: token, url: base }]);
  const editor = await editorCtx.newPage();
  const errors: string[] = [];
  editor.on('pageerror', (e) => errors.push(String(e)));

  await step('anonymous /admin redirects to the login page', async () => {
    await visitor.goto(`${base}/admin`);
    expect(new URL(visitor.url()).pathname === '/admin/login', `landed on ${visitor.url()}`);
    expect(await visitor.getByRole('link', { name: /github/i }).count(), 'no GitHub sign-in link');
  });

  await step('the owner creates a page with blocks in the admin', async () => {
    await editor.goto(`${base}/admin/pages/new`);
    await editor.getByLabel(/^Title/).first().fill('About E2E');
    await editor.getByLabel(/^Slug/).fill('about-e2e');
    await editor.locator('select').last().selectOption('hero');
    await editor.getByRole('button', { name: 'Add block' }).click();
    await editor.getByLabel(/^Title/).nth(1).fill('We make e2e mugs');
    await editor.getByRole('button', { name: 'Save', exact: true }).click();
    await editor.locator('.ui-toasts').getByText('Saved').waitFor();
  });

  await step('drafts are not public', async () => {
    expect((await visitor.goto(`${base}/about-e2e`))!.status() === 404, 'draft page is public');
  });

  await step('the owner publishes the page', async () => {
    await editor.getByRole('button', { name: 'Publish', exact: true }).click();
    const confirm = editor.getByRole('button', { name: 'Confirm' });
    if (await confirm.count()) await confirm.click();
    await editor.locator('.ui-toasts').getByText('Publish: Done').waitFor();
  });

  await step('a visitor sees the published page, accessible, with SEO metadata', async () => {
    const res = await visitor.goto(`${base}/about-e2e`);
    expect(res!.status() === 200, `status ${res!.status()}`);
    expect((await visitor.locator('h1').innerText()).includes('We make e2e mugs'), 'hero h1 missing');
    expect((await visitor.locator('link[rel=canonical]').getAttribute('href')) === `${base}/about-e2e`, 'bad canonical');
    expect((await visitor.locator('header.site-chrome').count()) === 1, 'site header missing on a public page');
    const v = await axe(visitor);
    expect(!v.length, `axe: ${v.join(', ')}`);
  });

  await step('sitemap and llms.txt list the page', async () => {
    const index = await (await fetch(`${base}/sitemap.xml`)).text();
    const chunk = index.match(/<loc>([^<]+)<\/loc>/)?.[1];
    expect(chunk, `no sitemap chunk in ${index}`);
    expect((await (await fetch(chunk!.replace(/^https?:\/\/[^/]+/, base))).text()).includes(`${base}/about-e2e`), 'page not in sitemap');
    expect((await (await fetch(`${base}/llms.txt`)).text()).includes('About E2E'), 'page not in llms.txt');
  });

  await step('the admin panel has no accessibility violations and no client errors', async () => {
    await editor.goto(`${base}/admin/pages`);
    await editor.getByText('About E2E').first().waitFor();
    expect((await editor.locator('.site-chrome').count()) === 0, 'the site header and footer show over the admin panel');
    const v = await axe(editor);
    expect(!v.length, `axe: ${v.join(', ')}`);
    expect(!errors.length, `page errors: ${errors.join(' | ')}`);
  });

  await step('a landing makes no third-party request before consent, and loads pixels after it', async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const external: string[] = [];
    page.on('request', (r) => {
      if (!r.url().startsWith(base) && !r.url().startsWith('data:')) external.push(r.url());
    });
    await page.goto(`${base}/lp/promo`, { waitUntil: 'networkidle' });
    expect((await page.locator('h1').innerText()).includes('keeps coffee hot'), 'landing hero missing');
    expect(!external.length, `third-party requests without consent: ${external.join(', ')}`);
    await page.getByRole('button', { name: 'Accept all' }).click();
    await page.waitForTimeout(1500);
    expect(external.some((u) => u.includes('googletagmanager.com')), `GA4 not requested after consent: ${external.join(', ')}`);
    await ctx.close();
  });

  await step('the blog feeds are valid RSS, Atom and JSON Feed', async () => {
    const [rss, atom, json] = (await Promise.all(['feed.xml', 'atom.xml', 'feed.json'].map(async (f) => (await fetch(`${base}/blog/${f}`)).text()))) as [string, string, string];
    // Como cadena: tsx añadiría `__name(...)` a una función, y en el navegador no existe.
    const parsed = (await visitor.evaluate(`(() => {
      const p = (x) => new DOMParser().parseFromString(x, 'application/xml');
      const dr = p(${JSON.stringify(rss)});
      const da = p(${JSON.stringify(atom)});
      return {
        errors: dr.getElementsByTagName('parsererror').length + da.getElementsByTagName('parsererror').length,
        rssItem: dr.querySelector('rss > channel > item > title')?.textContent,
        atomEntry: da.getElementsByTagName('entry')[0]?.getElementsByTagName('title')[0]?.textContent,
        atomNs: da.documentElement.namespaceURI,
      };
    })()`)) as { errors: number; rssItem?: string; atomEntry?: string; atomNs: string };
    expect(!parsed.errors, 'feed XML is not well-formed');
    expect(parsed.rssItem === 'Hello world' && parsed.atomEntry === 'Hello world', `feed items: ${JSON.stringify(parsed)}`);
    expect(parsed.atomNs === 'http://www.w3.org/2005/Atom', 'Atom namespace');
    const feed = JSON.parse(json) as { version: string; items: Array<{ id: string; title: string; url: string }> };
    expect(feed.version === 'https://jsonfeed.org/version/1.1' && feed.items[0]?.title === 'Hello world' && feed.items[0].url === `${base}/blog/hello`, `JSON Feed: ${json.slice(0, 200)}`);
  });

  if (!process.env.E2E_SKIP_LIGHTHOUSE) {
    for (const [name, path] of [['landing', '/lp/promo'], ['blog post', '/blog/hello'], ['CMS page', '/about-e2e']] as const)
      await step(`Lighthouse (mobile) on the ${name}: every category ≥ 95`, async () => {
        const scores = lighthouse(`${base}${path}`);
        console.log(`  ${Object.entries(scores).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
        expect(Object.values(scores).every((v) => v >= 95), `scores below 95 on ${path}`);
      });
  }

  console.log('E2E OK');
} catch (e) {
  for (const p of browser.contexts().flatMap((c) => c.pages())) console.error(`\n--- ${p.url()}\n${[...(await p.locator('label, legend, button, select, h1, h2, [role=alert]').allInnerTexts().catch(() => []))].map((t) => t.replace(/\s+/g, ' ').slice(0, 60)).join(' | ').slice(-3000)}`);
  console.error(`\nServer log:\n${log.slice(-4000)}`);
  throw e;
} finally {
  await browser.close();
  stop();
}
process.exit(0);
