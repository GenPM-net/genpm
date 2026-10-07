// Post: cabecera, portada, contenido, autores, compartir, relacionados, comentarios y alta en la newsletter.
import type { Metadata } from 'next';
import '../../_components/blog.css';
import { draftMode } from 'next/headers';
import { notFound } from 'next/navigation';
import { getPost, relatedPosts } from '@/lib/blog';
import { RichText } from '@/lib/rich-text';
import { absoluteUrl, buildMetadata, jsonLd, jsonLdScript } from '@/lib/seo';
import { getSiteSettings } from '@/lib/site';
import { Comments } from '../../_components/comments';
import { PostCard } from '../../_components/post-card';
import { ShareLinks } from '../../_components/share-links';
import { SubscribeForm } from '../../_components/subscribe-form';
import { formatDate, mediaImage, postPath } from '../../_lib/blog';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function load(slug: string) {
  const { isEnabled } = await draftMode();
  return getPost(slug, { draft: isEnabled });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await load((await params).slug);
  if (!post) return {};
  const cover = await mediaImage(post.cover);
  return (await buildMetadata({
    title: post.data.seo?.title ?? post.title,
    description: post.data.seo?.description ?? post.excerpt,
    path: postPath(post),
    ...(cover && { image: cover.src }),
    ...((post.data.seo?.noindex || !post.publishedAt) && { noindex: true }),
  })) as Metadata;
}

export default async function PostPage({ params, searchParams }: Props) {
  const post = await load((await params).slug);
  if (!post) notFound();
  const sp = await searchParams;
  const [cover, related, settings] = await Promise.all([mediaImage(post.cover, { alt: post.coverAlt ?? '' }), relatedPosts(post), getSiteSettings()]);
  const authors = post.authorProfiles.map((a) => a.name).join(', ');
  const ld =
    post.publishedAt &&
    jsonLd.article({
      title: post.title,
      path: postPath(post),
      description: post.excerpt,
      publishedAt: post.publishedAt,
      modifiedAt: post.updatedAt,
      ...(cover && { image: cover.src }),
      ...(authors && { author: authors }),
      ...(settings && { publisher: settings }),
    });
  return (
    <main className="blk blog-post">
      <article aria-labelledby="post-title">
        <header>
          <p className="blog-meta">
            {post.categoryList.map((c, i) => (
              <span key={c.slug}>
                {i > 0 && ', '}
                <a href={`/blog/category/${c.slug}`}>{c.name}</a>
              </span>
            ))}
          </p>
          <h1 id="post-title">{post.title}</h1>
          <p className="blog-meta">
            {authors && (
              <>
                By{' '}
                {post.authorProfiles.map((a, i) => (
                  <span key={a.slug}>
                    {i > 0 && ', '}
                    <a href={`/blog/author/${a.slug}`}>{a.name}</a>
                  </span>
                ))}{' '}
                ·{' '}
              </>
            )}
            {post.publishedAt && <time dateTime={post.publishedAt.toISOString()}>{formatDate(post.publishedAt)}</time>} · {post.readingMinutes} min read
          </p>
        </header>
        {cover && <img {...cover} className="blog-post__cover" loading="eager" decoding="async" fetchPriority="high" alt={cover.alt} />}
        {post.membersOnly ? (
          <div className="ui-alert">
            <p>{post.excerpt}</p>
            <p>This post is for members only.</p>
          </div>
        ) : (
          <div className="blog-post__body">
            <RichText doc={post.data.body} />
          </div>
        )}
        {post.tagList.length > 0 && (
          <p className="blog-tags">
            Tags:{' '}
            {post.tagList.map((t, i) => (
              <span key={t.slug}>
                {i > 0 && ', '}
                <a href={`/blog/tag/${t.slug}`}>{t.name}</a>
              </span>
            ))}
          </p>
        )}
        <ShareLinks url={absoluteUrl(postPath(post))} title={post.title} />
      </article>
      {related.length > 0 && (
        <section aria-labelledby="related-title">
          <h2 id="related-title">Related posts</h2>
          <ul className="blk-grid blk-grid--3" role="list">
            {related.map((r) => (
              <li key={r.id}>
                <PostCard post={r} level={3} />
              </li>
            ))}
          </ul>
        </section>
      )}
      <SubscribeForm status={one(sp.newsletter)} />
      <Comments postId={post.id} status={one(sp.comment)} />
      {/* nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- JSON-LD escapado por jsonLdScript (<, >, &, U+2028/9): no puede cerrar el <script> */}
      {ld && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(ld) }} />}
    </main>
  );
}
