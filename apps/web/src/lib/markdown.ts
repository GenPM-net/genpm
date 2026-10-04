// MarkdownRenderer para contenido NO CONFIABLE (README y reglas de paquetes, web-ui-spec §6): el HTML crudo se escapa
// siempre, los enlaces solo admiten http(s)/relativos con rel="nofollow ugc noopener", las imágenes pasan por el
// proxy propio (CSP `img-src 'self'`) y el código se resalta en el servidor.
import { Marked, type Tokens } from 'marked';
import { highlight, langFor } from './highlight.js';

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function safeUrl(href: string, base?: string): string | null {
  try {
    const u = new URL(href, base ?? 'https://genpm.net');
    return u.protocol === 'https:' || u.protocol === 'http:' || u.protocol === 'mailto:' ? u.href : null;
  } catch {
    return null;
  }
}

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      // Recompone lo que no son tildes latinas: sílabas hangul y kana con dakuten (ド, ガ) no se parten en el id.
      .normalize('NFC')
      .replace(/<[^>]*>/g, '')
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64)
  );
}

export type RenderOptions = {
  /** Base para enlaces e imágenes relativas (p. ej. https://github.com/o/r/blob/<sha>/). */
  baseUrl?: string;
  rawBaseUrl?: string;
  trusted?: boolean;
  headings?: Array<{ depth: number; text: string; id: string }>;
};

export function renderMarkdown(src: string, opts: RenderOptions = {}): string {
  const md = new Marked({ gfm: true, breaks: false });
  md.use({
    renderer: {
      html(token: Tokens.HTML | Tokens.Tag) {
        return opts.trusted ? token.text : esc(token.text);
      },
      link(token: Tokens.Link) {
        const url = safeUrl(token.href, opts.baseUrl);
        const text = this.parser.parseInline(token.tokens);
        if (!url) return text;
        const external = !url.startsWith('https://genpm.net');
        return `<a href="${esc(url)}"${external ? ' rel="nofollow ugc noopener" target="_blank"' : ''}>${text}</a>`;
      },
      image(token: Tokens.Image) {
        const url = safeUrl(token.href, opts.rawBaseUrl ?? opts.baseUrl);
        if (!url) return esc(token.text);
        return `<img src="/img?u=${encodeURIComponent(url)}" alt="${esc(token.text)}" loading="lazy" decoding="async">`;
      },
      code(token: Tokens.Code) {
        return highlight(token.text, token.lang ? langFor(token.lang) : null);
      },
      heading(token: Tokens.Heading) {
        const text = this.parser.parseInline(token.tokens);
        const id = slugify(token.text);
        opts.headings?.push({ depth: token.depth, text: token.text, id });
        return `<h${token.depth} id="${id}">${text}</h${token.depth}>`;
      },
    },
  });
  return md.parse(src, { async: false }) as string;
}
