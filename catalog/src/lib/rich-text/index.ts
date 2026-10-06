// @core/rich-text — API pública del servidor. El editor (cliente) se importa aparte: `./editor.js`.
export { type Doc, docFromText, emptyDoc, isSafeHref, type Mark, type Node, NodeSchema, parseDoc, RichTextSchema } from './doc.js';
export { defaultEmbedLabel, embedUrl, escapeHtml, type RenderOptions, type ResolvedImage, toHtml } from './html.js';
export { RichText } from './react.js';
export { excerpt, headingIds, headings, readingTime, slugifyHeading, toPlainText } from './text.js';
