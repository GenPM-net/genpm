<!-- Generado por catalog/scripts/kit-snippets.mjs desde el proyecto de ejemplo: no editar a mano. -->
# @core/kit-landing: lines for `src/genpm/*.ts`

Add each line below to the project's registration files (created by @core/kit-cms from its `_templates/genpm`).
Skip a line that is already there (another kit may have added it), keep the trailing `// kit-…` comment so later
kits and removals can find it, and keep the project's own lines.

## `src/genpm/admin.ts`

In imports (top of the file):

```ts
import { landingPath } from '@/app/(landing)/_lib/landings'; // kit-landing
import { leadsByLandingWidget } from '@/app/(landing)/_lib/widgets'; // kit-landing
import { experimentsAdminResource } from '@/lib/experiments'; // kit-landing: A/B tests (optional)
```

In `widgets` (inside its list):

```ts
leadsByLandingWidget, // kit-landing
```

In `admin` → `resources` array:

```ts
{ ...contentAdminResource('landings', { path: landingPath }), group: 'Marketing' }, // kit-landing
experimentsAdminResource, // kit-landing: A/B tests (optional)
```

## `src/genpm/blocks.ts`

In imports (top of the file):

```ts
import { countdown } from '@/app/(landing)/_blocks/countdown'; // kit-landing
```

In `blocks` (inside its list):

```ts
countdown, // kit-landing
```

## `src/genpm/content.ts`

In imports (top of the file):

```ts
import '@/app/(landing)/_lib/landings'; // kit-landing: colección landings
import '@/app/(landing)/_lib/conversion'; // kit-landing: evento lead en servidor (job)
```

## `src/genpm/seo.ts`

In imports (top of the file):

```ts
import { landingPath } from '@/app/(landing)/_lib/landings'; // kit-landing
```

In top level (after the imports):

```ts
registerSitemapSource(contentSitemapSource('landings', landingPath)); // kit-landing
```
