import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { testDb } from '../db/__fixtures__/pglite.js';
import { media } from '../media/index.js';
import * as mediaSchema from '../media/schema.js';
import { backendStorage, memoryBackend, setStorage } from '../storage/index.js';
import { type BlockInstance, collectMediaIds, coreBlocks, createBlockRegistry, defineBlock, hero, parseVideoUrl, RenderBlocks } from './index.js';
import { allBlocks, allMedia } from './__fixtures__/page.js';
import { loadBlockMedia } from './media.js';

const registry = createBlockRegistry(coreBlocks);
const render = (props: Partial<Parameters<typeof RenderBlocks>[0]> = {}) =>
  renderToStaticMarkup(h(RenderBlocks, { blocks: allBlocks, registry, media: allMedia, renderForm: (k) => h('form', { 'data-form': k }, 'FORM'), onSkip: () => {}, ...props }));

describe('registry and schema', () => {
  it('rejects duplicate or invalid types', () => {
    expect(() => createBlockRegistry([...coreBlocks, coreBlocks[0]!])).toThrow(/duplicate/);
    expect(() => defineBlock({ ...hero, type: 'Bad Type' })).toThrow(/invalid/);
    expect(coreBlocks).toHaveLength(15);
  });

  it('validates every block with its own schema and applies defaults', () => {
    const parsed = registry.schema.parse(allBlocks);
    expect(parsed[0]!.data).toMatchObject({ align: 'start', asPageTitle: true });
    expect(parsed[1]!.data.columns).toBe(3);

    const bad = registry.schema.safeParse([
      { id: 'a', type: 'hero', data: { title: '' } },
      { id: 'a', type: 'nope', data: {} },
      { id: 'c', type: 'cta', data: { title: 'x', ctaLabel: 'x', ctaHref: 'javascript:alert(1)' } },
      { id: 'd', type: 'video', data: { url: 'https://evil.test/video' } },
    ]);
    expect(bad.success).toBe(false);
    expect(bad.error!.issues.map((i) => i.path.join('.'))).toEqual(['0.data.title', '1.id', '1.type', '2.data.ctaHref', '3.data.url']);
  });

  it('collects media ids, including inside lists, ignoring hidden blocks', () => {
    const ids = collectMediaIds([...allBlocks, { id: 'h', type: 'gallery', hidden: true, data: { items: [{ image: 'med_hidden' }] } }], registry);
    expect(ids.sort()).toEqual(['med_avatar', 'med_benefit', 'med_g1', 'med_hero', 'med_logo', 'med_missing']);
  });

  it('parses video urls', () => {
    expect(parseVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1')).toEqual({ provider: 'youtube', id: 'dQw4w9WgXcQ' });
    expect(parseVideoUrl('https://youtube.com/shorts/dQw4w9WgXcQ')).toEqual({ provider: 'youtube', id: 'dQw4w9WgXcQ' });
    expect(parseVideoUrl('https://vimeo.com/123456789')).toEqual({ provider: 'vimeo', id: '123456789' });
    expect(parseVideoUrl('https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ')).toBeNull();
  });
});

describe('RenderBlocks', () => {
  it('renders the 15 blocks with exactly one h1', () => {
    const html = render();
    for (const b of allBlocks) expect(html, b.type).toContain(`blk-${b.type}`);
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toMatch(/<h1[^>]*id="b-hero-title"/);
    expect(html).toContain('Hello rich text');
    expect(html).toContain('data-form="contact"');
    expect(html).toContain('fetchPriority="high"'); // el hero es el primer bloque (LCP)
    expect(html).toContain('rel="noopener noreferrer"'); // enlace externo
  });

  it('never uses h1 when the page already has one, and only the first hero gets it', () => {
    expect(render({ hasPageTitle: true })).not.toContain('<h1');
    const twoHeroes = render({ blocks: [allBlocks[0]!, { ...allBlocks[0]!, id: 'hero2' }] });
    expect(twoHeroes.match(/<h1/g)).toHaveLength(1);
    expect(twoHeroes).toMatch(/<h2[^>]*id="b-hero2-title"/);
  });

  it('skips hidden, unknown and invalid blocks and reports them', () => {
    const skipped: string[] = [];
    const html = render({
      blocks: [
        { id: 'x', type: 'unknown', data: {} },
        { id: 'y', type: 'cta', data: { title: 'no link' } },
        { id: 'z', type: 'cta', hidden: true, data: { title: 'Hidden', ctaLabel: 'x', ctaHref: '/x' } },
      ],
      onSkip: (b, reason) => skipped.push(`${b.id}:${reason}`),
    });
    expect(html).toBe('');
    expect(skipped).toEqual(['x:unknown', 'y:invalid']);
  });

  it('escapes FAQ structured data so it cannot close the script tag', () => {
    const html = render({ blocks: [allBlocks[6]!] });
    const script = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)![1]!;
    expect(script).not.toContain('</script');
    expect(JSON.parse(script).mainEntity[0].acceptedAnswer.text).toBe('Yes </script><script>alert(1)</script>');
    expect(render({ blocks: [{ ...allBlocks[6]!, data: { ...allBlocks[6]!.data, structuredData: false } }] })).not.toContain('ld+json');
  });

  it('loads no third-party video unless iframes are allowed', () => {
    const block = [allBlocks[9]!];
    const link = render({ blocks: block });
    expect(link).not.toContain('<iframe');
    expect(link).toContain('href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"');
    const iframe = render({ blocks: block, embeds: 'iframe' });
    expect(iframe).toContain('src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"');
    expect(iframe).toContain('title="Demo"');
  });

  it('hides images that are not resolved and the form block without a renderer', () => {
    const html = render({ media: {}, renderForm: undefined });
    expect(html).not.toContain('<img');
    expect(html).not.toContain('blk-form');
  });

  it('accepts blocks registered by other packages', () => {
    const latest = defineBlock({ type: 'latest-posts', label: 'Latest posts', schema: z.object({ count: z.number().default(3) }), fields: [], Component: ({ data }) => h('p', { className: 'blk blk-latest-posts' }, `${data.count} posts`) });
    const reg = createBlockRegistry([...coreBlocks, latest]);
    expect(renderToStaticMarkup(h(RenderBlocks, { blocks: [{ id: 'l', type: 'latest-posts', data: {} }], registry: reg }))).toContain('3 posts');
  });
});

describe('loadBlockMedia', () => {
  let db: Awaited<ReturnType<typeof testDb>>;
  beforeEach(async () => {
    db = await testDb(mediaSchema);
    setStorage(backendStorage('memory', memoryBackend(), { secret: 's'.repeat(32), baseUrl: 'https://site.test' }));
    delete process.env.MEDIA_TRANSFORM;
  });

  it('resolves ready media in one query and ignores pending ones', async () => {
    const [ready] = await db
      .insert(media)
      .values({ key: 'public/media/a.jpg', filename: 'a.jpg', mime: 'image/jpeg', size: 10, width: 800, height: 600, alt: 'A photo', status: 'ready' })
      .returning();
    const [pending] = await db.insert(media).values({ key: 'public/media/b.jpg', filename: 'b.jpg', mime: 'image/jpeg', size: 10, status: 'pending' }).returning();
    const blocks: BlockInstance[] = [{ id: 'g', type: 'gallery', data: { items: [{ image: ready!.id }, { image: pending!.id }] } }];
    const out = await loadBlockMedia(blocks, registry);
    expect(Object.keys(out)).toEqual([ready!.id]);
    expect(out[ready!.id]).toMatchObject({ alt: 'A photo', width: 800, height: 600 });
    expect(out[ready!.id]!.src).toContain('public/media/a.jpg');
    expect(await loadBlockMedia([], registry)).toEqual({});
  });
});
