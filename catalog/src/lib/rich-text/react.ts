// Render a React (Server Components o cliente) con las mismas reglas que `toHtml`: sin innerHTML.
import { createElement as h, Fragment, type ReactNode } from 'react';
import type { Doc, Mark, Node } from './doc.ts';
import { isSafeHref } from './doc.ts';
import { defaultEmbedLabel, embedUrl, isExternal, type RenderOptions } from './html.ts';
import { headingIds } from './text.ts';

const MARK_TAG = { bold: 'strong', italic: 'em', strike: 's', code: 'code', underline: 'u' } as const;

function withMarks(content: ReactNode, marks: Mark[] | undefined, o: RenderOptions, key: number): ReactNode {
  let el = content;
  for (const m of marks ?? []) {
    if (m.type !== 'link') el = h(MARK_TAG[m.type], null, el);
    else if (isSafeHref(m.attrs.href)) {
      const ext = isExternal(m.attrs.href, o.siteHost);
      el = h('a', { href: m.attrs.href, target: m.attrs.target ?? undefined, rel: ext || m.attrs.target ? (o.externalRel ?? 'noopener noreferrer') : undefined }, el);
    }
  }
  return h(Fragment, { key }, el);
}

/** `<RichText doc={post.body} resolveImage={…} />` */
export function RichText(props: { doc: Doc } & RenderOptions): ReactNode {
  const { doc, ...o } = props;
  const ids = headingIds(doc);
  let hi = 0;
  const render = (nodes: Node[] | undefined): ReactNode[] => (nodes ?? []).map((n, i) => node(n, i));
  const node = (n: Node, key: number): ReactNode => {
    switch (n.type) {
      case 'text':
        return withMarks(n.text, n.marks, o, key);
      case 'paragraph':
        return h('p', { key }, render(n.content));
      case 'heading':
        return h(`h${n.attrs.level}`, { key, id: ids[hi++] }, render(n.content));
      case 'bulletList':
        return h('ul', { key }, render(n.content));
      case 'orderedList':
        return h('ol', { key, start: n.attrs?.start }, render(n.content));
      case 'listItem':
        return h('li', { key }, render(n.content));
      case 'blockquote':
        return h('blockquote', { key }, render(n.content));
      case 'codeBlock':
        return h('pre', { key }, h('code', { className: n.attrs?.language ? `language-${n.attrs.language}` : undefined }, render(n.content)));
      case 'horizontalRule':
        return h('hr', { key });
      case 'hardBreak':
        return h('br', { key });
      case 'image': {
        const img = o.resolveImage?.(n.attrs) ?? (n.attrs.src && isSafeHref(n.attrs.src) ? { src: n.attrs.src, alt: n.attrs.alt ?? '' } : null);
        if (!img) return null;
        return h('figure', { key }, h('img', { ...img, srcSet: img.srcSet, loading: 'lazy', decoding: 'async' }), n.attrs.title ? h('figcaption', null, n.attrs.title) : null);
      }
      case 'embed': {
        const mode = o.embeds ?? 'link';
        const src = embedUrl(n.attrs.provider, n.attrs.id, mode);
        return mode === 'iframe'
          ? h('div', { key, className: 'embed' }, h('iframe', { src, title: `${n.attrs.provider} video`, loading: 'lazy', allow: 'encrypted-media; picture-in-picture; fullscreen', referrerPolicy: 'strict-origin-when-cross-origin', sandbox: 'allow-scripts allow-same-origin allow-presentation' }))
          : h('p', { key, className: 'embed' }, h('a', { href: src, rel: 'noopener noreferrer', target: '_blank' }, (o.embedLabel ?? defaultEmbedLabel)(n.attrs.provider)));
      }
    }
  };
  return h(Fragment, null, render(doc.content));
}
