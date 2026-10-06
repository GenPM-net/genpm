// Fuentes de sitemap y buscador del blog, y recursos del panel.
import { contentAdminResource, contentSearchSource, contentSitemapSource } from '../content/index.js';
import { type Doc, toPlainText } from '../rich-text/index.js';
import { BLOG_COLLECTIONS } from './collections.js';

type PathFn = (p: { slug: string; locale: string }) => string;
const defaultPath: PathFn = ({ slug }) => `/blog/${slug}`;

export const blogSitemapSource = (path: PathFn = defaultPath) => contentSitemapSource('posts', path);

/** Documentos de búsqueda con el cuerpo en texto plano. Los posts `membersOnly` solo indexan título y extracto. */
export const blogSearchSource = (path: PathFn = defaultPath) =>
  contentSearchSource('posts', {
    type: 'post',
    path,
    title: (d) => String(d.title ?? ''),
    text: (d) => (d.membersOnly ? String(d.excerpt ?? '') : `${d.excerpt ?? ''}\n${toPlainText(d.body as Doc)}`),
  });

/** Recursos del panel: posts, autores, categorías, etiquetas y series. */
export const blogAdminResources = () => BLOG_COLLECTIONS.map((c) => ({ ...contentAdminResource(c), group: 'Blog' }));
