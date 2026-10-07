// @core/rich-text — API pública del servidor. El editor (cliente) se importa aparte: `./editor.js`.
export { type Doc, docFromText, emptyDoc, isSafeHref, type Mark, type Node, NodeSchema, parseDoc, RichTextSchema } from './doc.ts';
export { defaultEmbedLabel, embedUrl, escapeHtml, type RenderOptions, type ResolvedImage, toHtml } from './html.ts';
export { RichText } from './react.ts';
export { excerpt, headingIds, headings, readingTime, slugifyHeading, toPlainText } from './text.ts';
