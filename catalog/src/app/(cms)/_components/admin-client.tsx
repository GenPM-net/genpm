'use client';
// App del panel con los campos especiales del CMS: bloques, texto enriquecido y medios.
import '@/lib/ui/ui.css';
import '@/lib/admin/admin.css';
import { useMemo } from 'react';
import { AdminApp, type FieldRenderer } from '@/lib/admin/client';
import type { BlockMeta } from '@/lib/blocks';
import { blocksRenderer } from '@/lib/blocks/editor';
import { MediaField } from './media-field';
import { RichTextField } from './rich-text-field';

/** `blocks`: metadatos de los bloques calculados en el servidor (`blockMeta`), nunca el registro con su código. */
export function AdminClient({ path, blocks }: { path: string; blocks: BlockMeta[] }) {
  const renderers = useMemo<Record<string, FieldRenderer>>(() => ({ richText: RichTextField, media: MediaField, blocks: blocksRenderer(blocks) }), [blocks]);
  return <AdminApp basePath="/admin" apiBase="/api/admin" path={path} renderers={renderers} />;
}
