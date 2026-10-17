import { createElement as h } from 'react';
import { z } from 'zod';
import { defineBlock } from '../define.ts';
import { Img, mediaId, optText, Section } from '../parts.ts';

export const gallery = defineBlock({
  type: 'gallery',
  label: 'Gallery',
  icon: 'images',
  schema: z.object({ title: optText(160), items: z.array(z.object({ image: mediaId, caption: optText(200) })).min(1).max(48) }),
  fields: [
    { name: 'title', label: 'Title', type: 'text' },
    {
      name: 'items',
      label: 'Images',
      type: 'list',
      required: true,
      fields: [
        { name: 'image', label: 'Image', type: 'media', required: true },
        { name: 'caption', label: 'Caption', type: 'text' },
      ],
    },
  ],
  defaults: () => ({ items: [] }),
  Component: ({ data, ctx }) =>
    h(
      Section,
      { id: ctx.id, block: 'gallery', title: data.title, ctx, label: 'Gallery' },
      h(
        'ul',
        { className: 'blk-gallery__list', role: 'list' },
        data.items.map((it, i) => {
          const img = ctx.image(it.image);
          return img && h('li', { key: i }, h('figure', null, h(Img, { image: img }), it.caption && h('figcaption', null, it.caption)));
        }),
      ),
    ),
});
