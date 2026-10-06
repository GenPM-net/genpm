import type { PostSummary } from '@/lib/blog';
import { formatDate, postPath } from '../_lib/paths';

export function PostCard({ post, level = 2 }: { post: PostSummary; level?: number }) {
  const H = `h${Math.min(Math.max(level, 2), 6)}` as 'h2';
  return (
    <article className="blk-card blog-card">
      <H>
        <a href={postPath(post)}>{post.title}</a>
      </H>
      <p className="blog-meta">
        {post.publishedAt && <time dateTime={post.publishedAt.toISOString()}>{formatDate(post.publishedAt)}</time>} · {post.readingMinutes} min read
        {post.membersOnly && ' · Members only'}
      </p>
      <p>{post.excerpt}</p>
    </article>
  );
}
