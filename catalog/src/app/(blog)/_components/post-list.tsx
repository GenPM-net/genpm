// Listado paginado (blog, categorías, etiquetas, autores, series y archivo).
import './blog.css';
import type { ReactNode } from 'react';
import type { PostSummary } from '@/lib/blog';
import { PostCard } from './post-card';

export function PostList(p: { title: string; intro?: ReactNode; posts: PostSummary[]; page: number; pages: number; basePath: string }) {
  const href = (n: number) => (n === 1 ? p.basePath : `${p.basePath}?page=${n}`);
  return (
    <main className="blk blog">
      <h1>{p.title}</h1>
      {p.intro}
      {p.posts.length ? (
        <ul className="blk-grid blk-grid--2 blog-list" role="list">
          {p.posts.map((post) => (
            <li key={post.id}>
              <PostCard post={post} />
            </li>
          ))}
        </ul>
      ) : (
        <p>No posts yet.</p>
      )}
      {p.pages > 1 && (
        <nav aria-label="Pagination" className="ui-pagination">
          {p.page > 1 && (
            <a className="ui-button ui-button--sm" href={href(p.page - 1)} rel="prev">
              Newer posts
            </a>
          )}
          <span aria-current="page">
            Page {p.page} of {p.pages}
          </span>
          {p.page < p.pages && (
            <a className="ui-button ui-button--sm" href={href(p.page + 1)} rel="next">
              Older posts
            </a>
          )}
        </nav>
      )}
      <p className="blog-feeds">
        <a href="/blog/feed.xml">RSS</a> · <a href="/blog/atom.xml">Atom</a> · <a href="/blog/feed.json">JSON Feed</a>
      </p>
    </main>
  );
}
