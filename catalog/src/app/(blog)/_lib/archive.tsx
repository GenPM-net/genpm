// Páginas de archivo por categoría, etiqueta, autor y serie: mismo listado con distinto filtro.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { listPosts } from '@/lib/blog';
import { getEntry } from '@/lib/content';
import { buildMetadata } from '@/lib/seo';
import { PostList } from '../_components/post-list';
import { BLOG_PATH, PER_PAGE, pageParam } from './blog';

export type ArchiveKind = { collection: 'categories' | 'tags' | 'authors' | 'series'; filter: 'category' | 'tag' | 'author' | 'series'; segment: string; label: string };
export type ArchiveProps = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

async function load(kind: ArchiveKind, slug: string) {
  const e = await getEntry<{ name: string; description?: string; bio?: string }>(kind.collection, slug);
  return e ? { name: e.data.name, about: e.data.description ?? e.data.bio } : null;
}

export function archive(kind: ArchiveKind) {
  return {
    async generateMetadata({ params }: ArchiveProps): Promise<Metadata> {
      const { slug } = await params;
      const t = await load(kind, slug);
      if (!t) return {};
      return (await buildMetadata({ title: `${kind.label}: ${t.name}`, path: `${BLOG_PATH}/${kind.segment}/${slug}`, ...(t.about && { description: t.about.slice(0, 160) }) })) as Metadata;
    },
    async Page({ params, searchParams }: ArchiveProps) {
      const { slug } = await params;
      const t = await load(kind, slug);
      if (!t) notFound();
      const page = pageParam(await searchParams);
      const { posts, pages } = await listPosts({ [kind.filter]: slug, page, perPage: PER_PAGE });
      return <PostList title={`${kind.label}: ${t.name}`} intro={t.about ? <p>{t.about}</p> : undefined} posts={posts} page={page} pages={pages} basePath={`${BLOG_PATH}/${kind.segment}/${slug}`} />;
    },
  };
}
