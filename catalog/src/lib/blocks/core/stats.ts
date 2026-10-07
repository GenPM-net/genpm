import { createElement as h } from 'react';
import { z } from 'zod';
import { defineBlock } from '../define.ts';
import { optText, Section, text } from '../parts.ts';

export const stats = defineBlock({
  type: 'stats',
  label: 'Stats',
  icon: 'chart',
  schema: z.object({ title: optText(160), items: z.array(z.object({ value: text(20), label: text(100) })).min(1).max(6), source: optText(200) }),
  fields: [
    { name: 'title', label: 'Title', type: 'text' },
    {
      name: 'items',
      label: 'Numbers',
      type: 'list',
      required: true,
      fields: [
        { name: 'value', label: 'Value', type: 'text', required: true },
        { name: 'label', label: 'Label', type: 'text', required: true },
      ],
    },
    { name: 'source', label: 'Source (claims must be verifiable)', type: 'text' },
  ],
  defaults: () => ({ items: [{ value: '100+', label: 'Customers' }] }),
  Component: ({ data, ctx }) =>
    h(
      Section,
      { id: ctx.id, block: 'stats', title: data.title, ctx, label: 'Stats' },
      h('dl', { className: 'blk-stats' }, data.items.map((it, i) => h('div', { key: i }, h('dt', null, it.label), h('dd', null, it.value)))),
      data.source && h('p', { className: 'blk__note' }, data.source),
    ),
});
