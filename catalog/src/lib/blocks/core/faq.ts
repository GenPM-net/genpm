import { createElement as h } from 'react';
import { z } from 'zod';
import { defineBlock } from '../define.ts';
import { JsonLd, optText, Section, text } from '../parts.ts';

export const faq = defineBlock({
  type: 'faq',
  label: 'FAQ',
  icon: 'help',
  schema: z.object({
    title: optText(160),
    items: z.array(z.object({ question: text(300), answer: text(3000) })).min(1).max(50),
    structuredData: z.boolean().default(true),
  }),
  fields: [
    { name: 'title', label: 'Title', type: 'text' },
    {
      name: 'items',
      label: 'Questions',
      type: 'list',
      required: true,
      fields: [
        { name: 'question', label: 'Question', type: 'text', required: true },
        { name: 'answer', label: 'Answer', type: 'textarea', required: true },
      ],
    },
    { name: 'structuredData', label: 'Add FAQPage structured data', type: 'boolean' },
  ],
  defaults: () => ({ items: [{ question: 'Question?', answer: 'Answer.' }], structuredData: true }),
  Component: ({ data, ctx }) =>
    h(
      Section,
      { id: ctx.id, block: 'faq', title: data.title, ctx, label: 'FAQ' },
      data.items.map((it, i) => h('details', { key: i, className: 'blk-faq__item' }, h('summary', null, it.question), h('p', null, it.answer))),
      data.structuredData &&
        h(JsonLd, {
          data: {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: data.items.map((it) => ({ '@type': 'Question', name: it.question, acceptedAnswer: { '@type': 'Answer', text: it.answer } })),
          },
        }),
    ),
});
