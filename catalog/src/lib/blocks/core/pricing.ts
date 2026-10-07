import { createElement as h } from 'react';
import { z } from 'zod';
import { defineBlock } from '../define.ts';
import { CtaLink, Heading, href, optText, Section, text } from '../parts.ts';

export const pricing = defineBlock({
  type: 'pricing',
  label: 'Pricing',
  icon: 'tag',
  schema: z.object({
    title: optText(160),
    intro: optText(400),
    plans: z
      .array(
        z.object({
          name: text(80),
          price: text(40),
          period: optText(40),
          description: optText(300),
          features: optText(2000),
          ctaLabel: optText(60),
          ctaHref: href,
          highlighted: z.boolean().default(false),
        }),
      )
      .min(1)
      .max(4),
    note: optText(300),
  }),
  fields: [
    { name: 'title', label: 'Title', type: 'text' },
    { name: 'intro', label: 'Introduction', type: 'textarea' },
    {
      name: 'plans',
      label: 'Plans',
      type: 'list',
      required: true,
      fields: [
        { name: 'name', label: 'Name', type: 'text', required: true },
        { name: 'price', label: 'Price (as shown, taxes included for consumers)', type: 'text', required: true },
        { name: 'period', label: 'Period', type: 'text' },
        { name: 'description', label: 'Description', type: 'textarea' },
        { name: 'features', label: 'Features (one per line)', type: 'textarea' },
        { name: 'ctaLabel', label: 'Button text', type: 'text' },
        { name: 'ctaHref', label: 'Button link', type: 'url' },
        { name: 'highlighted', label: 'Highlight', type: 'boolean' },
      ],
    },
    { name: 'note', label: 'Note (taxes, billing terms)', type: 'text' },
  ],
  defaults: () => ({ plans: [{ name: 'Basic', price: '€0' }] }),
  Component: ({ data, ctx }) =>
    h(
      Section,
      { id: ctx.id, block: 'pricing', title: data.title, intro: data.intro, ctx, label: 'Pricing' },
      h(
        'ul',
        { className: `blk-grid blk-grid--${Math.min(data.plans.length, 3)}`, role: 'list' },
        data.plans.map((p, i) =>
          h(
            'li',
            { key: i, className: `blk-card blk-plan${p.highlighted ? ' blk-plan--highlighted' : ''}` },
            h(Heading, { level: data.title ? ctx.level + 1 : ctx.level }, p.name),
            h('p', { className: 'blk-plan__price' }, h('strong', null, p.price), p.period && h('span', null, ` / ${p.period}`)),
            p.description && h('p', null, p.description),
            p.features &&
              h(
                'ul',
                { className: 'blk-checklist' },
                p.features
                  .split('\n')
                  .map((f) => f.trim())
                  .filter(Boolean)
                  .map((f, j) => h('li', { key: j }, f)),
              ),
            h(CtaLink, { href: p.ctaHref, label: p.ctaLabel, variant: p.highlighted ? 'primary' : 'default', siteHost: ctx.siteHost }),
          ),
        ),
      ),
      data.note && h('p', { className: 'blk__note' }, data.note),
    ),
});
