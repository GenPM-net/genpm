// Render de una lista de bloques. Sin condicionales por tipo: cada bloque se pinta con el componente de su definición.
import { createElement as h, Fragment, type ReactNode } from 'react';
import type { ResolvedImage } from '../rich-text/index.js';
import type { BlockContext, BlockInstance, BlockRegistry } from './define.js';

const dev = () => typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';

export type RenderBlocksProps = {
  blocks: BlockInstance[] | null | undefined;
  registry: BlockRegistry;
  /** Imágenes de @core/media ya resueltas (`await loadBlockMedia(blocks, registry)`). */
  media?: Record<string, ResolvedImage>;
  /** `true` si la página ya tiene su `h1` fuera de los bloques: ningún bloque usará `h1`. */
  hasPageTitle?: boolean;
  /** Nivel de encabezado de los bloques (2 por defecto). */
  level?: 2 | 3 | 4;
  embeds?: 'link' | 'iframe';
  siteHost?: string;
  renderForm?: (formKey: string) => ReactNode;
  /** Aviso para bloques desconocidos o inválidos (por defecto `console.warn` solo en desarrollo). */
  onSkip?: (block: BlockInstance, reason: 'unknown' | 'invalid') => void;
};

/** `<RenderBlocks blocks={page.data.blocks} registry={blocks} media={media} />` */
export function RenderBlocks(p: RenderBlocksProps): ReactNode {
  const image = (id: unknown): ResolvedImage | null => (typeof id === 'string' && p.media?.[id]) || null;
  const skip = p.onSkip ?? ((b, reason) => dev() && console.warn(`[blocks] skipped ${reason} block "${b.type}" (${b.id})`));
  let titleUsed = !!p.hasPageTitle;
  let first = true;
  const out: ReactNode[] = [];
  for (const b of p.blocks ?? []) {
    if (b.hidden) continue;
    const def = p.registry.get(b.type);
    if (!def) {
      skip(b, 'unknown');
      continue;
    }
    const parsed = def.schema.safeParse(b.data);
    if (!parsed.success) {
      skip(b, 'invalid');
      continue;
    }
    const isTitle = !titleUsed && !!def.pageTitle?.(parsed.data);
    if (isTitle) titleUsed = true;
    const ctx: BlockContext = {
      id: `b-${b.id.replace(/[^\w-]/g, '')}`,
      level: isTitle ? 1 : (p.level ?? 2),
      image,
      embeds: p.embeds ?? 'link',
      first,
      ...(p.siteHost && { siteHost: p.siteHost }),
      ...(p.renderForm && { renderForm: p.renderForm }),
    };
    first = false;
    out.push(h(Fragment, { key: b.id }, h(def.Component, { data: parsed.data, ctx })));
  }
  return h(Fragment, null, ...out);
}
