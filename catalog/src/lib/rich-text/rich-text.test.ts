import { getSchema } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import StarterKit from '@tiptap/starter-kit';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  type Doc,
  docFromText,
  excerpt,
  headings,
  isSafeHref,
  parseDoc,
  RichText,
  RichTextSchema,
  readingTime,
  toHtml,
  toPlainText,
} from './index.ts';

const doc: Doc = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Por qué tazas' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Hechas ' }, { type: 'text', text: 'a mano', marks: [{ type: 'bold' }] }, { type: 'text', text: ' en ' }, { type: 'text', text: 'Valencia', marks: [{ type: 'link', attrs: { href: 'https://es.wikipedia.org/wiki/Valencia' } }] }, { type: 'text', text: ' <3 & más' }] },
    { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Uno' }] }] }] },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Por qué tazas' }] },
    { type: 'image', attrs: { mediaId: 'med_1', alt: 'Taza roja', title: 'Nuestra taza' } },
    { type: 'embed', attrs: { provider: 'youtube', id: 'dQw4w9WgXcQ' } },
  ],
};

describe('schema', () => {
  it('accepts allowlisted nodes and rejects scripts, unknown nodes and unsafe links', () => {
    expect(parseDoc(doc)).toEqual(doc);
    const bad = (content: unknown[]) => RichTextSchema.safeParse({ type: 'doc', content }).success;
    expect(bad([{ type: 'script', text: 'alert(1)' }])).toBe(false);
    expect(bad([{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] }])).toBe(false);
    expect(bad([{ type: 'image', attrs: { src: 'data:image/svg+xml,<svg onload=alert(1)>' } }])).toBe(false);
    expect(bad([{ type: 'embed', attrs: { provider: 'youtube', id: '"><script>' } }])).toBe(false);
    expect(bad([{ type: 'text', text: 'x', html: '<b>' }])).toBe(false);
    for (const ok of ['/about', '#top', 'https://x.com', 'mailto:a@b.c', 'tel:+34600000000']) expect(isSafeHref(ok), ok).toBe(true);
    for (const no of ['javascript:x', 'JAVASCRIPT:x', '//evil.com', 'data:text/html,x', 'vbscript:x', '/a b']) expect(isSafeHref(no), no).toBe(false);
  });

  it('round-trips through the real Tiptap schema (what the editor produces)', () => {
    const schema = getSchema([
      StarterKit.configure({ link: false }),
      Link,
      Image.extend({ addAttributes() { return { ...this.parent?.(), mediaId: { default: null } }; } }),
    ]);
    // `embed` es un nodo propio de este paquete (el editor no lo genera).
    const tiptapDoc = { ...doc, content: doc.content.filter((n) => n.type !== 'embed') };
    const node = schema.nodeFromJSON(tiptapDoc);
    node.check();
    expect(RichTextSchema.safeParse(node.toJSON()).success).toBe(true);
  });
});

describe('rendering', () => {
  const resolveImage = (a: { mediaId?: string | null; alt?: string | null }) =>
    a.mediaId === 'med_1' ? { src: 'https://cdn.test/a.jpg', alt: a.alt ?? '', width: 800, height: 600 } : null;

  it('escapes text, marks external links and gives unique heading ids', () => {
    const html = toHtml(doc, { resolveImage });
    expect(html).toContain('<h2 id="por-que-tazas">Por qué tazas</h2>');
    expect(html).toContain('<h2 id="por-que-tazas-1">');
    expect(html).toContain('<strong>a mano</strong>');
    expect(html).toContain('<a href="https://es.wikipedia.org/wiki/Valencia" rel="noopener noreferrer">Valencia</a>');
    expect(html).toContain(' &lt;3 &amp; más');
    expect(html).toContain('<img src="https://cdn.test/a.jpg" alt="Taza roja" width="800" height="600" loading="lazy" decoding="async"><figcaption>Nuestra taza</figcaption>');
    expect(html).toContain('<a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ" rel="noopener noreferrer" target="_blank">Watch on YouTube</a>');
    expect(toHtml(doc, { embeds: 'iframe' })).toContain('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(toHtml(doc)).not.toContain('<img'); // sin resolver ni src: no se pinta
    expect(toHtml(doc, { embedLabel: () => 'Ver vídeo' })).toContain('>Ver vídeo</a>');
  });

  it('React output matches the HTML renderer', () => {
    const react = renderToStaticMarkup(createElement(RichText, { doc, resolveImage }));
    const normalize = (s: string) => s.replaceAll('&#x27;', '&#39;').replaceAll('<br/>', '<br>').replaceAll('<hr/>', '<hr>').replace(/<img([^>]*?)\/>/g, '<img$1>');
    const reorder = (s: string) => s.replace(/<img [^>]+>/g, (m) => m.split(' ').sort().join(' '));
    expect(reorder(normalize(react))).toBe(reorder(toHtml(doc, { resolveImage })));
  });
});

describe('text helpers', () => {
  it('plain text, reading time, excerpt, headings and docFromText', () => {
    expect(toPlainText(doc)).toBe('Por qué tazas\nHechas a mano en Valencia <3 & más\nUno\n\nPor qué tazas\nTaza roja');
    expect(readingTime(doc)).toBe(1);
    expect(readingTime(docFromText(Array(1000).fill('palabra').join(' ')))).toBe(4);
    expect(excerpt(docFromText('uno dos tres cuatro cinco seis'), 16)).toBe('uno dos tres…');
    expect(headings(doc)).toEqual([
      { level: 2, text: 'Por qué tazas', id: 'por-que-tazas' },
      { level: 2, text: 'Por qué tazas', id: 'por-que-tazas-1' },
    ]);
    expect(docFromText('Uno\n\nDos').content).toHaveLength(2);
  });

  it('headings() numbers nested headings in the same order as the renderers, so TOC anchors match', () => {
    const h = (level: 2 | 3, text: string) => ({ type: 'heading' as const, attrs: { level }, content: [{ type: 'text' as const, text }] });
    const nested: Doc = {
      type: 'doc',
      content: [
        { type: 'blockquote', content: [h(2, 'Intro')] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [h(3, 'Intro')] }] },
        h(2, 'Intro'),
        h(2, 'Final'),
      ],
    };
    const toc = headings(nested);
    expect(toc.map((x) => x.id)).toEqual(['intro', 'intro-1', 'intro-2', 'final']);
    const html = toHtml(nested);
    const reactHtml = renderToStaticMarkup(createElement(RichText, { doc: nested }));
    for (const out of [html, reactHtml]) {
      const ids = [...out.matchAll(/<h[1-6] id="([^"]+)"/g)].map((m) => m[1]);
      expect(ids).toEqual(toc.map((x) => x.id));
    }
  });
});
