// Render de una página de la colección `pages` con sus bloques. Lo usan el catch-all y la portada del proyecto
// (`app/page.tsx` → `export { default, generateMetadata } from './(cms)/_lib/home'`).
import type { Metadata } from 'next';
import { draftMode } from 'next/headers';
import type { ReactNode } from 'react';
import { admin as _registered, blocks, pagePath } from '@/genpm';
import { type BlockInstance, RenderBlocks } from '@/lib/blocks';
import { loadBlockMedia } from '@/lib/blocks/media';
import { getEntry } from '@/lib/content';
import { Form } from '@/lib/forms';
import { buildMetadata, type PageSeo } from '@/lib/seo';

void _registered; // importar @/genpm registra colecciones, formularios y fuentes

type PageData = { title: string; blocks: BlockInstance[]; seo?: { title?: string; description?: string; image?: string; noindex?: boolean } };
export type SearchParams = Record<string, string | string[] | undefined>;

export async function loadPage(slug: string) {
  const { isEnabled } = await draftMode();
  return getEntry<PageData>('pages', slug, { draft: isEnabled });
}

export async function pageMetadata(slug: string): Promise<Metadata> {
  const page = await loadPage(slug);
  if (!page) return {};
  const seo: PageSeo = { title: page.data.seo?.title ?? page.data.title, path: pagePath(page), locale: page.locale };
  if (page.data.seo?.description) seo.description = page.data.seo.description;
  if (page.data.seo?.image) seo.image = page.data.seo.image;
  if (page.data.seo?.noindex || page.status !== 'published') seo.noindex = true;
  return (await buildMetadata(seo)) as Metadata;
}

/** Página completa, o null si no existe (la ruta decide entre 404 y redirección). */
export async function CmsPage(p: { slug: string; searchParams?: SearchParams; embeds?: 'link' | 'iframe' }): Promise<ReactNode> {
  const page = await loadPage(p.slug);
  if (!page) return null;
  const media = await loadBlockMedia(page.data.blocks, blocks);
  return (
    <RenderBlocks
      blocks={page.data.blocks}
      registry={blocks}
      media={media}
      embeds={p.embeds ?? 'link'}
      renderForm={(key) => <Form formKey={key} searchParams={p.searchParams ?? {}} />}
    />
  );
}
