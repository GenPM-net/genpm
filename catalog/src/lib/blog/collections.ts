// Colecciones del blog sobre @core/content. Las relaciones se guardan por slug (autores, categorías, etiquetas, serie).
import { z } from 'zod';
import { defineCollection } from '../content/index.ts';
import type { AdminField } from '../contracts/index.ts';
import { RichTextSchema } from '../rich-text/index.ts';

const Slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const Seo = z.object({ title: z.string().max(70).optional(), description: z.string().max(170).optional(), noindex: z.boolean().optional() }).default({});

export const PostSchema = z.object({
  title: z.string().min(1).max(200),
  /** Resumen para listados y meta description; si falta se genera del cuerpo. */
  excerpt: z.string().max(300).optional(),
  body: RichTextSchema,
  /** Id de @core/media. */
  cover: z.string().max(64).optional(),
  coverAlt: z.string().max(300).optional(),
  authors: z.array(Slug).max(5).default([]),
  categories: z.array(Slug).max(5).default([]),
  tags: z.array(Slug).max(20).default([]),
  // Sin serie elegida en el panel llega `{ slug: null }`: se trata como "sin serie".
  series: z.preprocess(
    (v) => (v && typeof v === 'object' && (v as { slug?: unknown }).slug ? v : undefined),
    z.object({ slug: Slug, order: z.coerce.number().int().min(1).default(1) }).optional(),
  ),
  featured: z.boolean().default(false),
  /** Solo para suscriptores (con @core/billing: `hasEntitlement`). La web decide cómo ocultarlo. */
  membersOnly: z.boolean().default(false),
  seo: Seo,
});

export const AuthorSchema = z.object({
  name: z.string().min(1).max(120),
  bio: z.string().max(1000).optional(),
  avatar: z.string().max(64).optional(),
  links: z.array(z.object({ label: z.string().max(40), url: z.url() })).max(10).default([]),
  /** Usuario de @core/auth asociado (permisos `:own`). */
  userId: z.string().max(64).optional(),
});

export const TaxonomySchema = z.object({ name: z.string().min(1).max(80), description: z.string().max(500).optional() });

const postFields: AdminField[] = [
  { name: 'title', label: 'Title', type: 'text', required: true, list: true },
  { name: 'excerpt', label: 'Excerpt', type: 'textarea' },
  { name: 'body', label: 'Body', type: 'richText', required: true },
  { name: 'cover', label: 'Cover image', type: 'media' },
  { name: 'coverAlt', label: 'Cover alt text', type: 'text' },
  { name: 'authors', label: 'Authors', type: 'relation', relationTo: 'authors', relationKey: 'slug', many: true },
  { name: 'categories', label: 'Categories', type: 'relation', relationTo: 'categories', relationKey: 'slug', many: true, list: true },
  { name: 'tags', label: 'Tags', type: 'relation', relationTo: 'tags', relationKey: 'slug', many: true },
  { name: 'series.slug', label: 'Series', type: 'relation', relationTo: 'series', relationKey: 'slug' },
  { name: 'series.order', label: 'Part number in the series', type: 'number' },
  { name: 'featured', label: 'Featured', type: 'boolean', list: true },
  { name: 'membersOnly', label: 'Members only', type: 'boolean' },
  { name: 'seo.title', label: 'SEO title (≤ 70)', type: 'text' },
  { name: 'seo.description', label: 'SEO description (≤ 170)', type: 'textarea' },
  { name: 'seo.noindex', label: 'Hide from search engines', type: 'boolean' },
];

export const posts = defineCollection('posts', { schema: PostSchema, label: { singular: 'Post', plural: 'Posts' }, fields: postFields });
export const authors = defineCollection('authors', { schema: AuthorSchema, label: { singular: 'Author', plural: 'Authors' }, titleField: 'name' });
export const categories = defineCollection('categories', { schema: TaxonomySchema, label: { singular: 'Category', plural: 'Categories' }, titleField: 'name' });
export const tags = defineCollection('tags', { schema: TaxonomySchema, label: { singular: 'Tag', plural: 'Tags' }, titleField: 'name' });
export const series = defineCollection('series', { schema: TaxonomySchema, label: { singular: 'Series', plural: 'Series' }, titleField: 'name' });

export type PostData = z.infer<typeof PostSchema>;
export type AuthorData = z.infer<typeof AuthorSchema>;
export type TaxonomyData = z.infer<typeof TaxonomySchema>;
export const BLOG_COLLECTIONS = ['posts', 'authors', 'categories', 'tags', 'series'] as const;
