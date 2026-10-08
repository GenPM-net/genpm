// Fuentes de sitemap y buscador del blog, y recursos del panel.
import { defineSitemapSource } from '../contracts/index.ts';
import { contentAdminResource, contentSearchSource, contentSitemapSource } from '../content/index.ts';
import { type Doc, toPlainText } from '../rich-text/index.ts';
import { BLOG_COLLECTIONS } from './collections.ts';

type PathFn = (p: { slug: string; locale: string }) => string;
const defaultPath: PathFn = ({ slug }) => `/blog/${slug}`;

/** URLs de los posts publicados y, primero, el índice del blog (`index: false` si no hay página de índice). */
export const blogSitemapSource = (path: PathFn = defaultPath, opts: { index?: string | false } = {}) => {
  const posts = contentSitemapSource('posts', path);
  const index = opts.index ?? '/blog';
  return defineSitemapSource({
    name: posts.name,
    async *urls() {
      if (index) yield { loc: index };
      yield* posts.urls();
    },
  });
};

/** Documentos de búsqueda con el cuerpo en texto plano. Los posts `membersOnly` solo indexan título y extracto. */
export const blogSearchSource = (path: PathFn = defaultPath) =>
  contentSearchSource('posts', {
    type: 'post',
    path,
    title: (d) => String(d.title ?? ''),
    text: (d) => (d.membersOnly ? String(d.excerpt ?? '') : `${d.excerpt ?? ''}\n${toPlainText(d.body as Doc)}`),
  });

/** Recursos del panel: posts (con enlaces "Ver" y "Vista previa"), autores, categorías, etiquetas y series. */
export const blogAdminResources = (path: PathFn = defaultPath) =>
  BLOG_COLLECTIONS.map((c) => ({ ...contentAdminResource(c, c === 'posts' ? { path } : {}), group: 'Blog' }));
