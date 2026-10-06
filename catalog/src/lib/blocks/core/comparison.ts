import { createElement as h, type ReactNode } from 'react';
import { z } from 'zod';
import { defineBlock } from '../define.ts';
import { optText, Section, text } from '../parts.ts';

const cell = (v: string): ReactNode => {
  const t = v.trim().toLowerCase();
  if (t === 'yes' || t === 'true') return h('span', null, h('span', { 'aria-hidden': true }, '✓'), h('span', { className: 'ui-visually-hidden' }, 'Yes'));
  if (t === 'no' || t === 'false') return h('span', null, h('span', { 'aria-hidden': true }, '✗'), h('span', { className: 'ui-visually-hidden' }, 'No'));
  return v;
};

export const comparison = defineBlock({
  type: 'comparison',
  label: 'Comparison',
  icon: 'table',
  schema: z.object({
    title: optText(160),
    us: text(60),
    them: text(60),
    rows: z.array(z.object({ feature: text(160), us: text(80), them: text(80) })).min(1).max(30),
  }),
  fields: [
    { name: 'title', label: 'Title', type: 'text' },
    { name: 'us', label: 'Our column', type: 'text', required: true },
    { name: 'them', label: 'Other column', type: 'text', required: true, help: 'Comparative claims must be objective and verifiable.' },
    {
      name: 'rows',
      label: 'Rows ("yes"/"no" show as ✓/✗)',
      type: 'list',
      required: true,
      fields: [
        { name: 'feature', label: 'Feature', type: 'text', required: true },
        { name: 'us', label: 'Ours', type: 'text', required: true },
        { name: 'them', label: 'Theirs', type: 'text', required: true },
      ],
    },
  ],
  defaults: () => ({ us: 'Us', them: 'Others', rows: [{ feature: 'Feature', us: 'yes', them: 'no' }] }),
  Component: ({ data, ctx }) =>
    h(
      Section,
      { id: ctx.id, block: 'comparison', title: data.title, ctx, label: 'Comparison' },
      h(
        'table',
        { className: 'ui-table' },
        h('caption', { className: 'ui-visually-hidden' }, data.title ?? `${data.us} / ${data.them}`),
        h('thead', null, h('tr', null, h('td', null), h('th', { scope: 'col' }, data.us), h('th', { scope: 'col' }, data.them))),
        h('tbody', null, data.rows.map((r, i) => h('tr', { key: i }, h('th', { scope: 'row' }, r.feature), h('td', null, cell(r.us)), h('td', null, cell(r.them))))),
      ),
    ),
});
