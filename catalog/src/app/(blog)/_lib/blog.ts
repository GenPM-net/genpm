// Utilidades del blog con datos (registro del proyecto e imágenes de @core/media).
import '@/genpm';
import { getMedia, imgAttrs } from '@/lib/media';
import type { ResolvedImage } from '@/lib/rich-text';

export { BLOG_PATH, formatDate, PER_PAGE, pageParam, postPath } from './paths';
/** Imagen de @core/media lista para `<img>` (o null si no existe o no está lista). */
export async function mediaImage(id: string | undefined, opts: { sizes?: string; alt?: string; priority?: boolean } = {}): Promise<ResolvedImage | null> {
  if (!id) return null;
  const m = await getMedia(id);
  if (!m || m.status !== 'ready') return null;
  const a = imgAttrs(m, { sizes: opts.sizes ?? '(min-width: 768px) 720px, 100vw', ...(opts.priority && { priority: true }) });
  return { src: a.src, alt: opts.alt ?? a.alt, ...(a.width && { width: a.width }), ...(a.height && { height: a.height }), ...(a.srcSet && { srcSet: a.srcSet }), ...(a.sizes && { sizes: a.sizes }) };
}
