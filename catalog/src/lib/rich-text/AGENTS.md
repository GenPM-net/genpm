# @core/rich-text — rules for AI agents

## Purpose
Rich text stored as JSON (Tiptap/ProseMirror format), never as HTML. `RichTextSchema` allowlists nodes (paragraphs,
headings, lists, quotes, code, images from @core/media, YouTube/Vimeo embeds), marks and links (site paths, `#`,
http(s), mailto, tel). Renders to HTML or React with full escaping, plain text, excerpts, reading time and a table of
contents with stable heading ids. Includes a Tiptap editor component. No tables, no collaboration.

## Map
- `index.ts` — server API: `RichTextSchema`, `parseDoc`, `toHtml`, `RichText` (React), `toPlainText`, `excerpt`, `readingTime`, `headings`.
- `editor.ts` — `RichTextEditor` (client component, `'use client'`); import it from `.../rich-text/editor.js` only in client code.
- `doc.ts` — schema and link rules. `html.ts`, `react.ts` — renderers. `text.ts` — text helpers.

## Integration
1. Install the npm deps if GenPM did not (`@tiptap/*`, `react`).
2. In content schemas use `body: RichTextSchema` (with @core/content: `defineCollection('posts', { schema: z.object({ title: z.string(), body: RichTextSchema }) })`).
3. Render: `<RichText doc={post.body} resolveImage={(a) => a.mediaId ? imgAttrs(mediaById[a.mediaId]) : null} siteHost="example.com" />`
   (load the media rows first; the resolver is synchronous). Non-React: `toHtml(doc, options)`.
4. Edit: `<RichTextEditor value={doc} onChange={setDoc} onPickImage={openMediaPicker} labels={…} />` in a client component.
5. Search/SEO: `toPlainText(doc)` for @core/search bodies and `excerpt(doc)` for descriptions.
6. Verify: a link `javascript:alert(1)` is rejected by `parseDoc`; rendered HTML has no `<script>`.

## Conventions
- Validate every document coming from a client with `parseDoc` (or the collection schema) before saving.
- Embeds render as plain links by default; use `embeds: 'iframe'` only where the site has consent for third-party video.
- Pass `labels`/`embedLabel` with translated texts; defaults are English.

## Don't
- Don't store or render HTML from users; don't use `dangerouslySetInnerHTML` with document content.
- Don't add nodes or marks without extending `NodeSchema` and both renderers.
- Don't import `editor.ts` in server code (it needs the browser).
