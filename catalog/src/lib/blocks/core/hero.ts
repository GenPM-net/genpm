import { createElement as h } from 'react';
import { z } from 'zod';
import { defineBlock } from '../define.ts';
import { CtaLink, Heading, href, Img, mediaId, optText, text } from '../parts.ts';

export const hero = defineBlock({
  type: 'hero',
  label: 'Hero',
  icon: 'layout',
  schema: z.object({
    eyebrow: optText(80),
    title: text(160),
    subtitle: optText(400),
    image: mediaId,
    ctaLabel: optText(60),
    ctaHref: href,
    secondaryLabel: optText(60),
    secondaryHref: href,
    align: z.enum(['start', 'center']).default('start'),
    asPageTitle: z.boolean().default(true),
  }),
  fields: [
    { name: 'eyebrow', label: 'Eyebrow', type: 'text' },
    { name: 'title', label: 'Title', type: 'text', required: true },
    { name: 'subtitle', label: 'Subtitle', type: 'textarea' },
    { name: 'image', label: 'Image', type: 'media' },
    { name: 'ctaLabel', label: 'Button text', type: 'text' },
    { name: 'ctaHref', label: 'Button link', type: 'url' },
    { name: 'secondaryLabel', label: 'Secondary button text', type: 'text' },
    { name: 'secondaryHref', label: 'Secondary button link', type: 'url' },
    { name: 'align', label: 'Alignment', type: 'select', options: [{ value: 'start', label: 'Start' }, { value: 'center', label: 'Center' }] },
    { name: 'asPageTitle', label: 'Use as page title (h1)', type: 'boolean' },
  ],
  defaults: () => ({ title: 'Your headline', align: 'start', asPageTitle: true }),
  pageTitle: (d) => d.asPageTitle,
  Component: ({ data, ctx }) =>
    h(
      'section',
      { className: `blk blk-hero blk-hero--${data.align}`, 'aria-labelledby': `${ctx.id}-title` },
      h(
        'div',
        { className: 'blk-hero__text' },
        data.eyebrow && h('p', { className: 'blk-hero__eyebrow' }, data.eyebrow),
        h(Heading, { level: ctx.level, id: `${ctx.id}-title`, className: 'blk-hero__title' }, data.title),
        data.subtitle && h('p', { className: 'blk-hero__subtitle' }, data.subtitle),
        (data.ctaHref || data.secondaryHref) &&
          h(
            'div',
            { className: 'blk__actions' },
            h(CtaLink, { href: data.ctaHref, label: data.ctaLabel, variant: 'primary', siteHost: ctx.siteHost }),
            h(CtaLink, { href: data.secondaryHref, label: data.secondaryLabel, siteHost: ctx.siteHost }),
          ),
      ),
      h(Img, { image: ctx.image(data.image), className: 'blk-hero__image', priority: ctx.first }),
    ),
});
