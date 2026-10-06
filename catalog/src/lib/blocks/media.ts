// Resolución de imágenes de @core/media para los bloques, en una sola consulta.
import { and, eq, inArray } from 'drizzle-orm';
import type { Executor } from '../db/index.ts';
import { getDb } from '../db/index.ts';
import { imgAttrs, media } from '../media/index.ts';
import type { ResolvedImage } from '../rich-text/index.ts';
import { type BlockInstance, type BlockRegistry, collectMediaIds } from './define.ts';

/** `const images = await loadBlockMedia(page.blocks, blocks)` → `<RenderBlocks media={images} />`. */
export async function loadBlockMedia(
  blocks: BlockInstance[] | null | undefined,
  registry: BlockRegistry,
  opts: { sizes?: string; db?: Executor } = {},
): Promise<Record<string, ResolvedImage>> {
  const ids = collectMediaIds(blocks ?? [], registry);
  if (!ids.length) return {};
  const rows = await (opts.db ?? getDb())
    .select()
    .from(media)
    .where(and(inArray(media.id, ids), eq(media.status, 'ready')));
  const out: Record<string, ResolvedImage> = {};
  for (const m of rows) {
    const a = imgAttrs(m, { sizes: opts.sizes ?? '(min-width: 1024px) 50vw, 100vw' });
    out[m.id] = { src: a.src, alt: a.alt, ...(a.width && { width: a.width }), ...(a.height && { height: a.height }), ...(a.srcSet && { srcSet: a.srcSet }), ...(a.sizes && { sizes: a.sizes }) };
  }
  return out;
}
