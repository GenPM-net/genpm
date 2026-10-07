// @core/blog — API pública. Importa desde aquí. Las rutas y plantillas las pone la app o @core/kit-blog.
export {
  AuthorSchema,
  type AuthorData,
  authors,
  BLOG_COLLECTIONS,
  categories,
  type PostData,
  PostSchema,
  posts,
  series,
  type TaxonomyData,
  TaxonomySchema,
  tags,
} from './collections.ts';
export { atomFeed, type FeedOptions, jsonFeed, rssFeed } from './feeds.ts';
export {
  archive,
  getPost,
  type ListPostsOptions,
  listPosts,
  type Named,
  type Post,
  type PostSummary,
  postsInMonth,
  relatedPosts,
  summarize,
} from './posts.ts';
export { blogAdminResources, blogSearchSource, blogSitemapSource } from './sources.ts';
