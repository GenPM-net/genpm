// Render a HTML con escape completo: solo salen las etiquetas y atributos que este archivo escribe.
import type { Doc, Mark, Node } from './doc.ts';
import { isSafeHref } from './doc.ts';
import { headingIds } from './text.ts';

export type ResolvedImage = { src: string; alt: string; width?: number; height?: number; srcSet?: string; sizes?: string };

export type RenderOptions = {
  /** Resuelve imágenes de @core/media (`mediaId`) a URL y atributos. Sin él, solo se pintan imágenes con `src`. */
  resolveImage?: (attrs: { mediaId?: string | null; src?: string | null; alt?: string | null }) => ResolvedImage | null;
  /** `link` (por defecto): enlace al vídeo, sin cargar nada de terceros. `iframe`: reproductor sin cookies (requiere consentimiento si aplica). */
  embeds?: 'link' | 'iframe';
  /** rel para enlaces externos. Default `noopener noreferrer`. */
  externalRel?: string;
  /** Host del sitio, para no marcar como externos sus propios enlaces absolutos. */
  siteHost?: string;
  /** Texto del enlace a vídeos (`embeds: 'link'`), traducible. */
  embedLabel?: (provider: 'youtube' | 'vimeo') => string;
};

export const defaultEmbedLabel = (p: 'youtube' | 'vimeo') => `Watch on ${p === 'youtube' ? 'YouTube' : 'Vimeo'}`;

export const escapeHtml = (s: string) =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

export function embedUrl(provider: 'youtube' | 'vimeo', id: string, mode: 'link' | 'iframe'): string {
  if (provider === 'youtube') return mode === 'iframe' ? `https://www.youtube-nocookie.com/embed/${id}` : `https://www.youtube.com/watch?v=${id}`;
  return mode === 'iframe' ? `https://player.vimeo.com/video/${id}?dnt=1` : `https://vimeo.com/${id}`;
}

export function isExternal(href: string, siteHost?: string): boolean {
  if (!/^https?:\/\//i.test(href)) return false;
  try {
    return new URL(href).host !== siteHost;
  } catch {
    return true;
  }
}

function linkAttrs(m: Extract<Mark, { type: 'link' }>, o: RenderOptions): string {
  if (!isSafeHref(m.attrs.href)) return '';
  const ext = isExternal(m.attrs.href, o.siteHost);
  return ` href="${escapeHtml(m.attrs.href)}"${m.attrs.target === '_blank' ? ' target="_blank"' : ''}${ext || m.attrs.target === '_blank' ? ` rel="${escapeHtml(o.externalRel ?? 'noopener noreferrer')}"` : ''}`;
}

const MARK_TAG = { bold: 'strong', italic: 'em', strike: 's', code: 'code', underline: 'u' } as const;

function text(n: Extract<Node, { type: 'text' }>, o: RenderOptions): string {
  let html = escapeHtml(n.text);
  for (const m of n.marks ?? []) {
    if (m.type === 'link') {
      const attrs = linkAttrs(m, o);
      html = attrs ? `<a${attrs}>${html}</a>` : html;
    } else html = `<${MARK_TAG[m.type]}>${html}</${MARK_TAG[m.type]}>`;
  }
  return html;
}

export function toHtml(doc: Doc, o: RenderOptions = {}): string {
  const ids = headingIds(doc);
  let h = 0;
  const render = (nodes: Node[] | undefined): string => (nodes ?? []).map(node).join('');
  const node = (n: Node): string => {
    switch (n.type) {
      case 'text':
        return text(n, o);
      case 'paragraph':
        return `<p>${render(n.content)}</p>`;
      case 'heading':
        return `<h${n.attrs.level} id="${escapeHtml(ids[h++] ?? '')}">${render(n.content)}</h${n.attrs.level}>`;
      case 'bulletList':
        return `<ul>${render(n.content)}</ul>`;
      case 'orderedList':
        return `<ol${n.attrs?.start && n.attrs.start !== 1 ? ` start="${n.attrs.start}"` : ''}>${render(n.content)}</ol>`;
      case 'listItem':
        return `<li>${render(n.content)}</li>`;
      case 'blockquote':
        return `<blockquote>${render(n.content)}</blockquote>`;
      case 'codeBlock':
        return `<pre><code${n.attrs?.language ? ` class="language-${escapeHtml(n.attrs.language)}"` : ''}>${render(n.content)}</code></pre>`;
      case 'horizontalRule':
        return '<hr>';
      case 'hardBreak':
        return '<br>';
      case 'image': {
        const img = o.resolveImage?.(n.attrs) ?? (n.attrs.src && isSafeHref(n.attrs.src) ? { src: n.attrs.src, alt: n.attrs.alt ?? '' } : null);
        if (!img) return '';
        const extra = [
          img.width && ` width="${img.width}"`,
          img.height && ` height="${img.height}"`,
          img.srcSet && ` srcset="${escapeHtml(img.srcSet)}"`,
          img.sizes && ` sizes="${escapeHtml(img.sizes)}"`,
        ].filter(Boolean).join('');
        return `<figure><img src="${escapeHtml(img.src)}" alt="${escapeHtml(img.alt)}"${extra} loading="lazy" decoding="async">${n.attrs.title ? `<figcaption>${escapeHtml(n.attrs.title)}</figcaption>` : ''}</figure>`;
      }
      case 'embed': {
        const mode = o.embeds ?? 'link';
        const url = escapeHtml(embedUrl(n.attrs.provider, n.attrs.id, mode));
        return mode === 'iframe'
          ? `<div class="embed"><iframe src="${url}" title="${n.attrs.provider} video" loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation"></iframe></div>`
          : `<p class="embed"><a href="${url}" rel="noopener noreferrer" target="_blank">${escapeHtml((o.embedLabel ?? defaultEmbedLabel)(n.attrs.provider))}</a></p>`;
      }
    }
  };
  return render(doc.content);
}
