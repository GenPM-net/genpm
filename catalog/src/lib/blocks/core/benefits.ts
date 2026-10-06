import { createElement as h } from 'react';
import { z } from 'zod';
import { defineBlock } from '../define.ts';
import { Img, mediaId, optText, Section, text } from '../parts.ts';

export const benefits = defineBlock({
  type: 'benefits',
  label: 'Benefits',
  icon: 'check',
  schema: z.object({
    title: optText(160),
    intro: optText(400),
    image: mediaId,
    items: z.array(z.object({ text: text(200) })).min(1).max(12),
  }),
  fields: [
    { name: 'title', label: 'Title', type: 'text' },
    { name: 'intro', label: 'Introduction', type: 'textarea' },
    { name: 'image', label: 'Image', type: 'media' },
    { name: 'items', label: 'Benefits', type: 'list', required: true, fields: [{ name: 'text', label: 'Benefit', type: 'text', required: true }] },
  ],
  defaults: () => ({ items: [{ text: 'Benefit' }] }),
  Component: ({ data, ctx }) =>
    h(
      Section,
      { id: ctx.id, block: 'benefits', title: data.title, intro: data.intro, ctx },
      h('div', { className: 'blk-split' }, h('ul', { className: 'blk-checklist' }, data.items.map((it, i) => h('li', { key: i }, it.text))), h(Img, { image: ctx.image(data.image) })),
    ),
});
