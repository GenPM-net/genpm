import { createElement as h } from 'react';
import { z } from 'zod';
import { defineBlock } from '../define.ts';
import { CtaLink, href, optText, Section, text } from '../parts.ts';

export const cta = defineBlock({
  type: 'cta',
  label: 'Call to action',
  icon: 'megaphone',
  schema: z.object({ title: text(160), text: optText(400), ctaLabel: text(60), ctaHref: href.pipe(z.string()), tone: z.enum(['primary', 'neutral']).default('primary') }),
  fields: [
    { name: 'title', label: 'Title', type: 'text', required: true },
    { name: 'text', label: 'Text', type: 'textarea' },
    { name: 'ctaLabel', label: 'Button text', type: 'text', required: true },
    { name: 'ctaHref', label: 'Button link', type: 'url', required: true },
    { name: 'tone', label: 'Style', type: 'select', options: [{ value: 'primary', label: 'Primary' }, { value: 'neutral', label: 'Neutral' }] },
  ],
  defaults: () => ({ title: 'Ready?', ctaLabel: 'Get started', ctaHref: '/', tone: 'primary' }),
  Component: ({ data, ctx }) =>
    h(Section, { id: ctx.id, block: 'cta', title: data.title, intro: data.text, ctx, className: `blk-cta--${data.tone}` }, h('div', { className: 'blk__actions' }, h(CtaLink, { href: data.ctaHref, label: data.ctaLabel, variant: 'primary', siteHost: ctx.siteHost }))),
});
