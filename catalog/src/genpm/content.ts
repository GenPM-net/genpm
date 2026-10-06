// Colecciones del sitio. Importar @/lib/site y @/lib/forms registra también ajustes, menús y formularios del panel.
import '@/lib/site';
import '@/lib/forms';
import { z } from 'zod';
import { defineCollection } from '@/lib/content';
import { SeoFieldsSchema, seoAdminFields } from '@/lib/seo';
import { blocks } from './blocks';

/** Ruta pública de una página: la de slug `home` es la portada. */
export const pagePath = (e: { slug: string }) => (e.slug === 'home' ? '/' : `/${e.slug}`);

export const pages = defineCollection('pages', {
  label: { singular: 'Page', plural: 'Pages' },
  schema: z.object({
    title: z.string().min(1).max(160),
    blocks: blocks.schema.default([]),
    seo: SeoFieldsSchema,
  }),
  fields: [
    { name: 'title', label: 'Title', type: 'text', required: true, list: true },
    blocks.field('blocks', 'Sections'),
    ...seoAdminFields,
  ],
});
