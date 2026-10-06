'use client';
// App del panel con los campos especiales del CMS: bloques, texto enriquecido y medios.
import '@/lib/ui/ui.css';
import '@/lib/admin/admin.css';
import { blocks } from '@/genpm/blocks';
import { AdminApp, type FieldRenderer } from '@/lib/admin/client';
import { blocksRenderer } from '@/lib/blocks/editor';
import { MediaField } from './media-field';
import { RichTextField } from './rich-text-field';

const renderers: Record<string, FieldRenderer> = {
  richText: RichTextField,
  media: MediaField,
  blocks: blocksRenderer(blocks),
};

export function AdminClient({ path }: { path: string }) {
  return <AdminApp basePath="/admin" apiBase="/api/admin" path={path} renderers={renderers} />;
}
