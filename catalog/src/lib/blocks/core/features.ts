import { createElement as h } from 'react';
import { z } from 'zod';
import { defineBlock } from '../define.js';
import { Heading, optText, Section, text } from '../parts.js';

export const features = defineBlock({
  type: 'features',
  label: 'Features',
  icon: 'grid',
  schema: z.object({
    title: optText(160),
    intro: optText(400),
    columns: z.coerce.number().int().min(2).max(4).default(3),
    items: z.array(z.object({ title: text(120), text: optText(400), icon: optText(40) })).min(1).max(12),
  }),
  fields: [
    { name: 'title', label: 'Title', type: 'text' },
    { name: 'intro', label: 'Introduction', type: 'textarea' },
    { name: 'columns', label: 'Columns', type: 'select', options: [{ value: '2', label: '2' }, { value: '3', label: '3' }, { value: '4', label: '4' }] },
    {
      name: 'items',
      label: 'Features',
      type: 'list',
      required: true,
      fields: [
        { name: 'title', label: 'Title', type: 'text', required: true },
        { name: 'text', label: 'Text', type: 'textarea' },
        { name: 'icon', label: 'Icon (emoji or name)', type: 'text' },
      ],
    },
  ],
  defaults: () => ({ columns: 3, items: [{ title: 'Feature' }] }),
  Component: ({ data, ctx }) =>
    h(
      Section,
      { id: ctx.id, block: 'features', title: data.title, intro: data.intro, ctx },
      h(
        'ul',
        { className: `blk-grid blk-grid--${data.columns}`, role: 'list' },
        data.items.map((it, i) =>
          h(
            'li',
            { key: i, className: 'blk-card' },
            it.icon && h('span', { className: 'blk-card__icon', 'aria-hidden': true }, it.icon),
            h(Heading, { level: data.title ? ctx.level + 1 : ctx.level }, it.title),
            it.text && h('p', null, it.text),
          ),
        ),
      ),
    ),
});
