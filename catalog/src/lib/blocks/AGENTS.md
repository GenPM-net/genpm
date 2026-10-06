# @core/blocks — rules for AI agents

## Purpose
Page sections that editors combine from the admin: hero, features, benefits, testimonials, logos, pricing, FAQ (with
FAQPage JSON-LD), call to action, gallery, video, stats, comparison, guarantee, rich text and form. Each block is a
zod schema + editor fields + a React component. Other packages and kits add their own blocks (product grid, latest
posts…) to the same registry. Blocks are stored as JSON inside @core/content entries; no tables of its own.

## Map
- `index.ts` — `defineBlock`, `createBlockRegistry`, `coreBlocks` (and each block), `RenderBlocks`, `collectMediaIds`.
- `core/*.ts` — one file per block. `parts.ts` — `Section`, `Heading`, `Img`, `CtaLink`, `JsonLd` for new blocks.
- `media.ts` — `loadBlockMedia(blocks, registry)` (server: one query to @core/media).
- `editor.ts` — `'use client'`: `blocksRenderer(registry)` for `AdminApp`. `blocks.css` — styles on @core/ui tokens.

## Integration
1. Create `src/genpm/blocks.ts`: `export const blocks = createBlockRegistry([...coreBlocks /*, kit blocks */]);`
2. Add a field to a content collection: schema `blocks: blocks.schema`, admin field `blocks.field('blocks', 'Sections')`.
3. Admin: `<AdminApp renderers={{ blocks: blocksRenderer(blocks), /* richText, media… */ }} />`.
4. Page (server component):
   ```tsx
   const media = await loadBlockMedia(page.data.blocks, blocks);
   return <RenderBlocks blocks={page.data.blocks} registry={blocks} media={media}
     renderForm={(key) => <Form formKey={key} />} embeds={hasConsent('marketing') ? 'iframe' : 'link'} />;
   ```
5. Styles: import `src/lib/ui/ui.css` then `src/lib/blocks/blocks.css` in the root layout.
6. Verify: a page with every block passes axe and has one `h1`; a block with an unknown type renders nothing and warns in dev.

## Conventions
- A new block = new file with `defineBlock` + entry in the registry. Never add `if (type === …)` to `RenderBlocks`.
- Use `Section` and `Heading` with `ctx.level` (items one level below); only blocks with `pageTitle` may become the `h1`.
- Images are media ids resolved with `loadBlockMedia`; links go through the `href` schema (no `javascript:`).
- Text in blocks is plain text; use the `rich-text` block for formatting.

## Don't
- Don't render user HTML (`dangerouslySetInnerHTML`) except via `JsonLd`, which escapes `<`, `>` and `&`.
- Don't load video iframes without marketing consent (`embeds: 'link'` is the default).
- Don't invent testimonials, ratings or statistics; the editor help texts remind users these must be real and verifiable.
