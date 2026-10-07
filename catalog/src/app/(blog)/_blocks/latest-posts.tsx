// Bloque "Últimos posts" para páginas del CMS (registrado en src/genpm/blocks.ts).
import { z } from 'zod';
import { listPosts } from '@/lib/blog';
import { defineBlock, Section } from '@/lib/blocks';
import { PostCard } from '../_components/post-card';
import Link from 'next/link';

export const latestPosts = defineBlock({
  type: 'latest-posts',
  label: 'Latest posts',
  icon: 'newspaper',
  schema: z.object({
    title: z.string().trim().max(160).optional(),
    count: z.coerce.number().int().min(1).max(12).default(3),
    category: z.string().max(80).optional().transform((v) => v || undefined),
  }),
  fields: [
    { name: 'title', label: 'Title', type: 'text' },
    { name: 'count', label: 'Number of posts', type: 'number' },
    { name: 'category', label: 'Only from category', type: 'relation', relationTo: 'categories', relationKey: 'slug' },
  ],
  defaults: () => ({ title: 'Latest posts', count: 3 }),
  Component: async ({ data, ctx }) => {
    const { posts } = await listPosts({ perPage: data.count, ...(data.category && { category: data.category }) });
    if (!posts.length) return null;
    return (
      <Section id={ctx.id} block="latest-posts" title={data.title} ctx={ctx} label="Latest posts">
        <ul className="blk-grid blk-grid--3" role="list">
          {posts.map((p) => (
            <li key={p.id}>
              <PostCard post={p} level={data.title ? ctx.level + 1 : ctx.level} />
            </li>
          ))}
        </ul>
        <p>
          <Link href="/blog">All posts</Link>
        </p>
      </Section>
    );
  },
});
