import { createElement as h } from 'react';
import { z } from 'zod';
import { defineBlock } from '../define.ts';
import { Img, mediaId, optText, Section, text } from '../parts.ts';

export const testimonials = defineBlock({
  type: 'testimonials',
  label: 'Testimonials',
  icon: 'quote',
  schema: z.object({
    title: optText(160),
    items: z
      .array(z.object({ quote: text(800), author: text(100), role: optText(120), avatar: mediaId, rating: z.coerce.number().int().min(1).max(5).optional() }))
      .min(1)
      .max(12),
  }),
  fields: [
    { name: 'title', label: 'Title', type: 'text' },
    {
      name: 'items',
      label: 'Testimonials',
      type: 'list',
      required: true,
      help: 'Only real testimonials from real customers (consumer protection law).',
      fields: [
        { name: 'quote', label: 'Quote', type: 'textarea', required: true },
        { name: 'author', label: 'Name', type: 'text', required: true },
        { name: 'role', label: 'Role or company', type: 'text' },
        { name: 'avatar', label: 'Photo', type: 'media' },
        { name: 'rating', label: 'Rating (1-5)', type: 'number' },
      ],
    },
  ],
  defaults: () => ({ items: [{ quote: '…', author: 'Name' }] }),
  Component: ({ data, ctx }) =>
    h(
      Section,
      { id: ctx.id, block: 'testimonials', title: data.title, ctx, label: 'Testimonials' },
      h(
        'ul',
        { className: 'blk-grid blk-grid--3', role: 'list' },
        data.items.map((it, i) =>
          h(
            'li',
            { key: i, className: 'blk-card' },
            h(
              'figure',
              null,
              it.rating && h('p', { className: 'blk-rating' }, h('span', { 'aria-hidden': true }, '★'.repeat(it.rating) + '☆'.repeat(5 - it.rating)), h('span', { className: 'ui-visually-hidden' }, `${it.rating} / 5`)),
              h('blockquote', null, h('p', null, it.quote)),
              h('figcaption', null, h(Img, { image: ctx.image(it.avatar), className: 'blk-avatar', alt: '' }), h('strong', null, it.author), it.role && h('span', null, ` · ${it.role}`)),
            ),
          ),
        ),
      ),
    ),
});
