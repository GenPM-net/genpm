import { createElement as h } from 'react';
import { z } from 'zod';
import { defineBlock } from '../define.ts';
import { href, optText, Section, text } from '../parts.ts';

export const guarantee = defineBlock({
  type: 'guarantee',
  label: 'Guarantee',
  icon: 'shield',
  schema: z.object({ badge: optText(30), title: text(160), text: text(1000), termsHref: href, termsLabel: optText(60) }),
  fields: [
    { name: 'badge', label: 'Badge (e.g. "30 days")', type: 'text' },
    { name: 'title', label: 'Title', type: 'text', required: true },
    { name: 'text', label: 'Text', type: 'textarea', required: true, help: 'Never present the legal 2-year guarantee or 14-day withdrawal right as an extra.' },
    { name: 'termsHref', label: 'Terms link', type: 'url' },
    { name: 'termsLabel', label: 'Terms link text', type: 'text' },
  ],
  defaults: () => ({ title: 'Money-back guarantee', text: '…' }),
  Component: ({ data, ctx }) =>
    h(
      Section,
      { id: ctx.id, block: 'guarantee', title: data.title, ctx },
      data.badge && h('p', { className: 'blk-guarantee__badge' }, data.badge),
      h('p', null, data.text),
      data.termsHref && h('p', null, h('a', { href: data.termsHref }, data.termsLabel ?? 'Terms')),
    ),
});
