// Documentación (web-ui-spec §5.5): Markdown del repo, por idioma con fallback a inglés. Cada página expone su `.md`.
import { en as enT, errorText, type Translator } from '@genpm/i18n';
import { ERROR_CODES, exitCode, httpStatus } from '@genpm/manifest';

const files = import.meta.glob('../content/docs/*/*.md', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>;

export type DocPage = {
  slug: string;
  locale: string;
  title: string;
  section: string;
  order: number;
  body: string;
  translated: boolean;
};

function parse(path: string, raw: string): DocPage {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const meta = Object.fromEntries(
    (m?.[1] ?? '').split('\n').map((l) => [l.slice(0, l.indexOf(':')).trim(), l.slice(l.indexOf(':') + 1).trim()]),
  );
  const [, locale, file] = path.match(/\/docs\/([^/]+)\/([^/]+)\.md$/)!;
  return {
    slug: file!,
    locale: locale!,
    title: meta['title'] ?? file!,
    section: meta['section'] ?? '',
    order: Number(meta['order'] ?? 99),
    body: m?.[2] ?? raw,
    translated: true,
  };
}

const ALL = Object.entries(files).map(([p, raw]) => parse(p, raw));

/** Página de códigos de error generada desde el catálogo único (una sección por E_*, enlazada desde problem+json),
 * en el idioma del lector: los mensajes salen del mismo catálogo que usan la CLI y la API. */
function errorsPage(t: Translator): DocPage {
  const body = ERROR_CODES.map((code) => {
    const { message, fix } = errorText(t, code, {});
    return `## ${code}\n\nHTTP ${httpStatus(code)} · exit ${exitCode(code)}\n\n${message.replace(/\{[^}]+\}/g, '…')}\n\n**${t.t('web.docs.fixLabel')}:** ${fix.replace(/\{[^}]+\}/g, '…')}\n`;
  }).join('\n');
  return {
    slug: 'errors',
    locale: t.locale,
    title: t.t('web.docs.errorsTitle'),
    section: t.t('web.docs.errorsSection'),
    order: 60,
    body: `${t.t('web.docs.errorsIntro')}\n\n${body}`,
    translated: true,
  };
}

const SECTION_KEYS: Record<string, string> = {
  'Getting started': 'gettingStarted',
  'Using packages': 'usingPackages',
  Publishing: 'publishing',
  'MCP server': 'mcpServer',
  Security: 'security',
  Guides: 'guides',
};

export function docPages(locale: string, t: Translator = enT): DocPage[] {
  const en = [...ALL.filter((d) => d.locale === 'en'), errorsPage(t)];
  return en
    .map((d) => {
      const tr = ALL.find((x) => x.locale === locale && x.slug === d.slug);
      if (tr) return tr;
      // Página sin traducir: el cuerpo sale en inglés (con aviso), pero título y sección van en el idioma del lector
      // para que el menú de la documentación no mezcle idiomas.
      const sectionKey = SECTION_KEYS[d.section];
      return {
        ...d,
        title: d.slug === 'errors' ? d.title : t.raw(`web.docs.pages.${d.slug}`),
        section: sectionKey ? t.raw(`web.docs.sections.${sectionKey}`) : d.section,
        translated: locale === 'en',
      };
    })
    .sort((a, b) => a.order - b.order);
}

export function docPage(locale: string, slug: string, t: Translator = enT): DocPage | null {
  return docPages(locale, t).find((d) => d.slug === slug) ?? null;
}
