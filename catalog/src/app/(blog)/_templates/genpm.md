<!-- Generado por catalog/scripts/kit-snippets.mjs desde el proyecto de ejemplo: no editar a mano. -->
# @core/kit-blog: lines for `src/genpm/*.ts`

Add each line below to the project's registration files (created by @core/kit-cms from its `_templates/genpm`).
Skip a line that is already there (another kit may have added it), keep the trailing `// kit-…` comment so later
kits and removals can find it, and keep the project's own lines.

## `src/genpm/admin.ts`

In imports (top of the file):

```ts
import { withSendAsCampaign } from '@/app/(blog)/_lib/campaign'; // kit-blog
import { pendingCommentsWidget } from '@/app/(blog)/_lib/widgets'; // kit-blog
import { blogAdminResources } from '@/lib/blog'; // kit-blog
import { commentsAdminResource } from '@/lib/comments'; // kit-blog kit-store
import { newsletterAdminResources } from '@/lib/newsletter'; // kit-blog
```

In top level (after the imports):

```ts
const [postsResource, ...blogTaxonomies] = blogAdminResources(); // kit-blog
```

In `widgets` (inside its list):

```ts
pendingCommentsWidget, // kit-blog
```

In `admin` → `resources` array:

```ts
withSendAsCampaign(postsResource!), // kit-blog
...blogTaxonomies, // kit-blog
commentsAdminResource, // kit-blog kit-store
...newsletterAdminResources(), // kit-blog
```

## `src/genpm/blocks.ts`

In imports (top of the file):

```ts
import { latestPosts } from '@/app/(blog)/_blocks/latest-posts'; // kit-blog
```

In `blocks` (inside its list):

```ts
latestPosts, // kit-blog
```

## `src/genpm/content.ts`

In imports (top of the file):

```ts
import '@/lib/blog'; // kit-blog: posts, authors, categories, tags, series
```

## `src/genpm/search.ts`

In imports (top of the file):

```ts
import { blogSearchSource } from '@/lib/blog'; // kit-blog
```

In top level (after the imports):

```ts
registerSearchSource(blogSearchSource()); // kit-blog
```

## `src/genpm/seo.ts`

In imports (top of the file):

```ts
import { blogSitemapSource } from '@/lib/blog'; // kit-blog
```

In top level (after the imports):

```ts
registerSitemapSource(blogSitemapSource()); // kit-blog
```
