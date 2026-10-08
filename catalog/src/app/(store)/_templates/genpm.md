<!-- Generated from the GenPM catalog example project. -->
# @core/kit-store: lines for `src/genpm/*.ts`

Add each line below to the project's registration files (created by @core/kit-cms from its `_templates/genpm`).
Skip a line that is already there (another kit may have added it), keep the trailing `// kit-…` comment so later
kits and removals can find it, and keep the project's own lines.

## `src/genpm/admin.ts`

In imports (top of the file):

```ts
import { legalPagesWidget } from '@/app/(store)/_lib/legal'; // kit-store
import { storeWidgets } from '@/app/(store)/_lib/widgets'; // kit-store
import { catalogAdminResources } from '@/lib/catalog'; // kit-store
import { commentsAdminResource } from '@/lib/comments'; // kit-blog kit-store
import { discountsAdminResource } from '@/lib/discounts'; // kit-store
import { ordersAdminResource } from '@/lib/orders'; // kit-store
import { shippingAdminResources } from '@/lib/shipping'; // kit-store
```

In `widgets` (inside its list):

```ts
...storeWidgets, // kit-store
legalPagesWidget, // kit-store
```

In `admin` → `resources` array:

```ts
commentsAdminResource, // kit-blog kit-store
...catalogAdminResources(), // kit-store
ordersAdminResource, // kit-store
...shippingAdminResources(), // kit-store
discountsAdminResource, // kit-store
```

## `src/genpm/blocks.ts`

In imports (top of the file):

```ts
import { buyNow, productGrid } from '@/app/(store)/_blocks/products'; // kit-store
```

In `blocks` (inside its list):

```ts
productGrid, // kit-store
buyNow, // kit-store
```

## `src/genpm/commerce.ts` (create it if missing)

```ts
import '@/lib/checkout'; // kit-store
import '@/lib/discounts'; // kit-store
import '@/lib/orders'; // kit-store
import '@/lib/reviews'; // kit-store
import '@/lib/shipping'; // kit-store
import '@/app/(store)/_lib/maintenance'; // kit-store: carritos caducados (store.maintenance)
```

## `src/genpm/index.ts`

In imports (top of the file):

```ts
import './commerce'; // kit-store
```

## `src/genpm/search.ts`

In imports (top of the file):

```ts
import { productSearchSource } from '@/lib/catalog'; // kit-store
```

In top level (after the imports):

```ts
registerSearchSource(productSearchSource()); // kit-store
```

## `src/genpm/seo.ts`

In imports (top of the file):

```ts
import { productSitemapSource } from '@/lib/catalog'; // kit-store
```

In top level (after the imports):

```ts
registerSitemapSource(productSitemapSource()); // kit-store
```
