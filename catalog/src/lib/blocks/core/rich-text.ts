import { createElement as h } from 'react';
import { z } from 'zod';
import { RichText, RichTextSchema } from '../../rich-text/index.js';
import { defineBlock } from '../define.js';

export const richText = defineBlock({
  type: 'rich-text',
  label: 'Text',
  icon: 'text',
  schema: z.object({ doc: RichTextSchema, width: z.enum(['narrow', 'wide']).default('narrow') }),
  fields: [
    { name: 'doc', label: 'Text', type: 'richText', required: true },
    { name: 'width', label: 'Width', type: 'select', options: [{ value: 'narrow', label: 'Narrow' }, { value: 'wide', label: 'Wide' }] },
  ],
  defaults: () => ({ doc: { type: 'doc', content: [{ type: 'paragraph' }] }, width: 'narrow' }),
  Component: ({ data, ctx }) =>
    h(
      'div',
      { className: `blk blk-rich-text blk-rich-text--${data.width}` },
      h(RichText, {
        doc: data.doc,
        embeds: ctx.embeds,
        ...(ctx.siteHost && { siteHost: ctx.siteHost }),
        resolveImage: (a) => (a.mediaId ? ctx.image(a.mediaId) : a.src ? { src: a.src, alt: a.alt ?? '' } : null),
      }),
    ),
});
