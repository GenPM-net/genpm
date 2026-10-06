import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { postsInMonth } from '@/lib/blog';
import { buildMetadata } from '@/lib/seo';
import { PostList } from '../../../../_components/post-list';
import { BLOG_PATH } from '../../../../_lib/blog';

type Props = { params: Promise<{ year: string; month: string }> };

function parse(p: { year: string; month: string }) {
  const year = Number(p.year);
  const month = Number(p.month);
  return Number.isInteger(year) && year >= 1990 && year <= 2200 && Number.isInteger(month) && month >= 1 && month <= 12 ? { year, month } : null;
}
const label = (year: number, month: number) => new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(Date.UTC(year, month - 1, 1));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const ym = parse(await params);
  return ym ? ((await buildMetadata({ title: `Archive: ${label(ym.year, ym.month)}`, path: `${BLOG_PATH}/archive/${ym.year}/${String(ym.month).padStart(2, '0')}`, noindex: true })) as Metadata) : {};
}

export default async function MonthArchive({ params }: Props) {
  const ym = parse(await params);
  if (!ym) notFound();
  const posts = await postsInMonth(ym.year, ym.month);
  return <PostList title={`Archive: ${label(ym.year, ym.month)}`} posts={posts} page={1} pages={1} basePath={`${BLOG_PATH}/archive/${ym.year}/${ym.month}`} />;
}
