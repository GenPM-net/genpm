<!-- Generated from the GenPM catalog example project. -->
# @core/kit-dropshipping: lines for `src/genpm/*.ts`

Add each line below to the project's registration files (created by @core/kit-cms from its `_templates/genpm`).
Skip a line that is already there (another kit may have added it), keep the trailing `// kit-…` comment so later
kits and removals can find it, and keep the project's own lines.

## `src/genpm/admin.ts`

In imports (top of the file):

```ts
import { dropshippingWidgets } from '@/app/(dropshipping)/_lib/widgets'; // kit-dropshipping
import { priceRulesAdminResource } from '@/lib/pricing'; // kit-dropshipping
import { suppliersAdminResources } from '@/lib/suppliers'; // kit-dropshipping
```

In `widgets` (inside its list):

```ts
...dropshippingWidgets, // kit-dropshipping
```

In `admin` → `resources` array:

```ts
...suppliersAdminResources(), // kit-dropshipping
priceRulesAdminResource, // kit-dropshipping
```

## `src/genpm/commerce.ts` (create it if missing)

```ts
import '@/lib/pricing'; // kit-dropshipping
import '@/lib/suppliers'; // kit-dropshipping: adaptador manual y reenvío de pedidos pagados
import '@/app/(dropshipping)/_lib/purchase'; // kit-dropshipping: evento purchase de servidor
```
