// Utilidades del blog con datos (registro del proyecto e imágenes de @core/media).
import '@/genpm';
import { imageFor } from '@/lib/media';

export { BLOG_PATH, formatDate, PER_PAGE, pageParam, postPath } from './paths';
/** Imagen de @core/media lista para `<img>` (o null si no existe o no está lista). */
export const mediaImage = (id: string | undefined, opts: { sizes?: string; alt?: string } = {}) =>
  imageFor(id, { sizes: opts.sizes ?? '(min-width: 768px) 720px, 100vw', ...(opts.alt !== undefined && { alt: opts.alt }) });
