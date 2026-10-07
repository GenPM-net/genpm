// Documento de texto enriquecido (JSON de Tiptap/ProseMirror) validado con lista blanca de nodos, marcas y enlaces.
import { z } from 'zod';

export type Mark =
  | { type: 'bold' | 'italic' | 'strike' | 'code' | 'underline' }
  | { type: 'link'; attrs: { href: string; target?: '_blank' | null } };

export type Node =
  | { type: 'text'; text: string; marks?: Mark[] }
  | { type: 'paragraph'; content?: Node[] }
  | { type: 'heading'; attrs: { level: 1 | 2 | 3 | 4 | 5 | 6 }; content?: Node[] }
  | { type: 'bulletList'; content: Node[] }
  | { type: 'orderedList'; attrs?: { start?: number }; content: Node[] }
  | { type: 'listItem'; content: Node[] }
  | { type: 'blockquote'; content: Node[] }
  | { type: 'codeBlock'; attrs?: { language?: string | null }; content?: Node[] }
  | { type: 'horizontalRule' }
  | { type: 'hardBreak' }
  | { type: 'image'; attrs: { mediaId?: string | null; src?: string | null; alt?: string | null; title?: string | null } }
  | { type: 'embed'; attrs: { provider: 'youtube' | 'vimeo'; id: string } };

export type Doc = { type: 'doc'; content: Node[] };

/** Enlaces permitidos: rutas del sitio, anclas, http(s), mailto y tel. Nunca `javascript:` ni `data:`. */
export function isSafeHref(href: string): boolean {
  if (/^\/(?![/\\])/.test(href) || href.startsWith('#')) return !/\s/.test(href);
  if (/^mailto:[^\s]+$/i.test(href) || /^tel:\+?[0-9 ()-]{3,30}$/i.test(href)) return true;
  try {
    const u = new URL(href);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

const Href = z.string().max(2000).refine(isSafeHref, 'unsafe link');
const MarkSchema: z.ZodType<Mark> = z.union([
  z.strictObject({ type: z.enum(['bold', 'italic', 'strike', 'code', 'underline']) }),
  z.strictObject({ type: z.literal('link'), attrs: z.object({ href: Href, target: z.enum(['_blank']).nullish() }) }),
]);

const inline = () => z.array(z.lazy(() => NodeSchema)).max(2000).optional();

export const NodeSchema: z.ZodType<Node> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.strictObject({ type: z.literal('text'), text: z.string().max(20_000), marks: z.array(MarkSchema).max(6).optional() }),
    z.strictObject({ type: z.literal('paragraph'), content: inline(), attrs: z.object({}).passthrough().optional() }),
    z.strictObject({ type: z.literal('heading'), attrs: z.object({ level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]) }), content: inline() }),
    z.strictObject({ type: z.literal('bulletList'), content: z.array(NodeSchema).max(500) }),
    z.strictObject({ type: z.literal('orderedList'), attrs: z.object({ start: z.number().int().min(0).max(100_000).optional() }).passthrough().optional(), content: z.array(NodeSchema).max(500) }),
    z.strictObject({ type: z.literal('listItem'), content: z.array(NodeSchema).max(200) }),
    z.strictObject({ type: z.literal('blockquote'), content: z.array(NodeSchema).max(500) }),
    z.strictObject({ type: z.literal('codeBlock'), attrs: z.object({ language: z.string().regex(/^[a-z0-9+#-]{0,20}$/).nullish() }).optional(), content: inline() }),
    z.strictObject({ type: z.literal('horizontalRule') }),
    z.strictObject({ type: z.literal('hardBreak') }),
    z.strictObject({
      type: z.literal('image'),
      attrs: z.object({
        mediaId: z.string().max(64).nullish(),
        src: Href.nullish(),
        alt: z.string().max(500).nullish(),
        title: z.string().max(300).nullish(),
      }),
    }),
    z.strictObject({ type: z.literal('embed'), attrs: z.object({ provider: z.enum(['youtube', 'vimeo']), id: z.string().regex(/^[A-Za-z0-9_-]{6,20}$/) }) }),
  ]),
) as z.ZodType<Node>;

/** Esquema para campos de contenido: `body: RichTextSchema`. */
export const RichTextSchema: z.ZodType<Doc> = z.strictObject({ type: z.literal('doc'), content: z.array(NodeSchema).max(5000) });

export const emptyDoc = (): Doc => ({ type: 'doc', content: [] });

/** Valida un documento de origen no fiable (formularios, API). Lanza ZodError si no cumple la lista blanca. */
export const parseDoc = (input: unknown): Doc => RichTextSchema.parse(input);

/** Documento a partir de texto plano (párrafos separados por líneas en blanco). */
export function docFromText(text: string): Doc {
  return {
    type: 'doc',
    content: text
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => ({ type: 'paragraph', content: [{ type: 'text', text: p }] })),
  };
}
