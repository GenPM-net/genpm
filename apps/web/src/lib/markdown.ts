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
        // Contenido de terceros (README, reglas): un nivel menos, para que la página tenga un único <h1> (el nuestro).
        const depth = opts.trusted ? token.depth : Math.min(token.depth + 1, 6);
        opts.headings?.push({ depth, text: token.text, id });
        return `<h${depth} id="${id}">${text}</h${depth}>`;
      },
    },
  });
  return md.parse(src, { async: false }) as string;
}

/** Primer párrafo de un Markdown como texto plano, para meta descripciones (≤ max caracteres, corta por palabra). */
export function excerpt(src: string, max = 155): string {
  const para =
    src
      .replace(/^---[\s\S]*?---\s*/, '')
      .replace(/```[\s\S]*?```/g, '')
      .split(/\n\s*\n/)
      .map((b) => b.trim())
      .find((b) => b && !/^(#|\||>|- |\* |\d+\. |<)/.test(b)) ?? '';
  const text = para
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_]/g, '')
    .replace(/\{\{\w+\}\}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20))}…`;
}
