import { createElement as h } from 'react';
import { z } from 'zod';
import { defineBlock } from '../define.js';
import { href, Img, mediaId, optText, Section, text } from '../parts.js';

export const logos = defineBlock({
  type: 'logos',
  label: 'Logos',
  icon: 'image',
  schema: z.object({
    title: optText(160),
    items: z.array(z.object({ name: text(100), image: mediaId, href })).min(1).max(24),
  }),
  fields: [
    { name: 'title', label: 'Title', type: 'text' },
    {
      name: 'items',
      label: 'Logos',
      type: 'list',
      required: true,
      fields: [
        { name: 'name', label: 'Name (used as alt text)', type: 'text', required: true },
        { name: 'image', label: 'Logo', type: 'media' },
        { name: 'href', label: 'Link', type: 'url' },
      ],
    },
  ],
  defaults: () => ({ items: [{ name: 'Company' }] }),
  Component: ({ data, ctx }) =>
    h(
      Section,
      { id: ctx.id, block: 'logos', title: data.title, ctx, label: 'Logos' },
      h(
        'ul',
        { className: 'blk-logos', role: 'list' },
        data.items.map((it, i) => {
          const img = ctx.image(it.image);
          const content = img ? h(Img, { image: img, alt: it.name }) : h('span', null, it.name);
          return h('li', { key: i }, it.href ? h('a', { href: it.href, rel: 'noopener noreferrer' }, content) : content);
        }),
      ),
    ),
});
