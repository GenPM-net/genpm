import { createElement as h } from 'react';
import { z } from 'zod';
import { embedUrl } from '../../rich-text/index.js';
import { defineBlock } from '../define.js';
import { optText, Section, text } from '../parts.js';

/** YouTube/Vimeo a partir de la URL que pega el editor. */
export function parseVideoUrl(url: string): { provider: 'youtube' | 'vimeo'; id: string } | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return /^[\w-]{11}$/.test(u.pathname.slice(1)) ? { provider: 'youtube', id: u.pathname.slice(1) } : null;
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      const id = u.searchParams.get('v') ?? u.pathname.match(/^\/(?:embed|shorts)\/([\w-]{11})/)?.[1];
      return id && /^[\w-]{11}$/.test(id) ? { provider: 'youtube', id } : null;
    }
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const id = u.pathname.match(/(\d{6,12})/)?.[1];
      return id ? { provider: 'vimeo', id } : null;
    }
  } catch {}
  return null;
}

export const video = defineBlock({
  type: 'video',
  label: 'Video',
  icon: 'video',
  schema: z.object({ title: optText(160), url: text(300).refine((u) => parseVideoUrl(u) !== null, 'Use a YouTube or Vimeo link'), caption: optText(300) }),
  fields: [
    { name: 'title', label: 'Title (also the player title)', type: 'text' },
    { name: 'url', label: 'YouTube or Vimeo link', type: 'url', required: true },
    { name: 'caption', label: 'Caption', type: 'text' },
  ],
  defaults: () => ({ url: '' }),
  Component: ({ data, ctx }) => {
    const v = parseVideoUrl(data.url);
    if (!v) return null;
    const name = data.title ?? (v.provider === 'youtube' ? 'YouTube video' : 'Vimeo video');
    return h(
      Section,
      { id: ctx.id, block: 'video', title: data.title, ctx, label: name },
      ctx.embeds === 'iframe'
        ? h(
            'div',
            { className: 'blk-video' },
            h('iframe', { src: embedUrl(v.provider, v.id, 'iframe'), title: name, loading: 'lazy', allow: 'fullscreen; picture-in-picture', referrerPolicy: 'strict-origin-when-cross-origin', sandbox: 'allow-scripts allow-same-origin allow-presentation' }),
          )
        : h('p', null, h('a', { href: embedUrl(v.provider, v.id, 'link'), rel: 'noopener noreferrer' }, `▶ ${name}`)),
      data.caption && h('p', { className: 'blk__note' }, data.caption),
    );
  },
});
