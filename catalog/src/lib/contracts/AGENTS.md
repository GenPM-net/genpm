# @core/contracts — rules for AI agents

## Purpose
Types and small zod schemas shared by GenPM catalog modules, so a module can consume "anything that provides content /
sitemap URLs / search documents / admin resources / payments" without importing the concrete module. No logic, no
tables, no runtime dependency besides `zod`.

## Map
- `index.ts` — public API. Import from here only.
- `content.ts` — `ContentSource`, `ContentEntry` (implemented by @core/content and CMS adapters).
- `sitemap.ts` — `SitemapSource` (consumed by @core/seo).
- `search.ts` — `SearchSource`, `SearchDocument` (consumed by @core/search).
- `admin.ts` — `AdminResource`, `AdminField` (consumed by @core/admin).
- `payment.ts` — `PaymentProvider` (implemented by @core/checkout, used by @core/orders).
- `events.ts` — `CommerceEvent`, `LeadEvent` and their zod schemas (consumed by @core/pixels).
- `money.ts` — `Money` (integer minor units + ISO 4217 code).

## Integration
1. Usually installed as a dependency of another module; nothing to wire.
2. To expose your own data to the admin, sitemap or search, implement the type and register it in the project file
   the consuming module documents (`src/genpm/admin.ts`, `src/genpm/seo.ts`, `src/genpm/search.ts`):
   ```ts
   import { defineSitemapSource } from './lib/contracts/index.ts';
   export const projects = defineSitemapSource({ name: 'projects', async *urls() { yield { loc: '/projects' }; } });
   ```
3. Validate untrusted tracking payloads with `TrackedEventSchema.parse(body)` before forwarding them.

## Conventions
- Money is always `{ amount: integer minor units, currency: 'EUR' }`; never floats.
- Sources are async iterables: stream rows in pages, don't load whole tables into memory.
- `AdminResource.input` validates create/update input; permissions are `<resource>:<action>` (`posts:update`).

## Don't
- Don't add implementations or helpers with behaviour here; put them in the module that owns the concept.
- Don't change an existing type incompatibly: every catalog module depends on it (major version of the whole train).
- Don't import other modules from this folder.
