# @core/catalog — rules for AI agents

## Purpose
Products for a store: up to 3 options (Size, Color…) and their variants with SKU, price/compare-at/cost in minor
units, stock with backorder rules, weight and image; categories (tree), manual ordered collections, tags, attributes,
per-locale translations, media references (@core/media ids), sitemap/search sources and admin resources.
`reserveStock` locks the variant row so two buyers can't get the last unit. No cart, prices rules or multi-warehouse.

## Map
- `index.ts` — public API: `createProduct`, `updateProduct`, `getProduct`, `listProducts`, `reserveStock`, `releaseStock`, `upsertCategory`, `setCollection`, `categoryTree`, `lowStockVariants`, `catalogAdminResources`.
- `products.ts` — products, variants, listing, stock. `taxonomy.ts` — categories and collections.
- `sources.ts` — `productSitemapSource`, `productSearchSource`. `admin.ts` — admin resources. `schema.ts` — tables.

## Integration
1. Env: `STORE_CURRENCY` (ISO code, default `EUR`). Migrations as in `src/lib/db/AGENTS.md`.
2. Product page: `const p = await getProduct(slug, { locale })` (404 when null); show `p.variants` with
   `format(v.price, locale)` (@core/money) and `v.availability`; render `p.description` with @core/rich-text.
3. Listing: `listProducts({ category, tag, collection, sort, page, minPrice, maxPrice, inStock })`.
4. Register `productSitemapSource()` (seo), `productSearchSource()` (search) and `...catalogAdminResources()` (admin).
5. JSON-LD with `jsonLd.product` (@core/seo) using `availability` and the real price.
6. Verify: create a product with two variants in the admin and see it at `/products/<slug>`.

## Conventions
- Prices are integers in `STORE_CURRENCY`; the server price is the only valid price (carts recompute it).
- Reserve stock only inside the order transaction (`reserveStock(id, qty, tx)`); release it on cancel/expiry.
- Archive products instead of deleting them: orders keep references to their variants.
- Permissions: `products:read|create|update|delete`.

## Don't
- Don't show a compare-at price that isn't real (the EU requires the lowest price of the last 30 days for discounts).
- Don't decrement `stock` with plain updates outside `reserveStock`/`releaseStock`.
- Don't expose `costAmount` in public pages or APIs.
