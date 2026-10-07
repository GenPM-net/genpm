import type { Metadata } from 'next';
import { listPosts } from '@/lib/blog';
import { buildMetadata } from '@/lib/seo';
import { PostList } from '../_components/post-list';
import { BLOG_PATH, PER_PAGE, pageParam } from '../_lib/blog';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const page = pageParam(await searchParams);
  return (await buildMetadata({ title: page > 1 ? `Blog – page ${page}` : 'Blog', path: page > 1 ? `${BLOG_PATH}?page=${page}` : BLOG_PATH })) as Metadata;
}

export default async function BlogIndex({ searchParams }: Props) {
  const page = pageParam(await searchParams);
  const { posts, pages } = await listPosts({ page, perPage: PER_PAGE });
  // En la primera página, los destacados primero.
  const ordered = page === 1 ? [...posts.filter((p) => p.featured), ...posts.filter((p) => !p.featured)] : posts;
  return <PostList title="Blog" posts={ordered} page={page} pages={pages} basePath={BLOG_PATH} />;
}
