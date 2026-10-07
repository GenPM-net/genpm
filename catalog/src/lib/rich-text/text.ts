// Texto plano, tiempo de lectura y tabla de contenidos.
import type { Doc, Node } from './doc.ts';

const BLOCKS = new Set(['paragraph', 'heading', 'listItem', 'blockquote', 'codeBlock']);

function walk(nodes: Node[] | undefined, out: string[]): void {
  for (const n of nodes ?? []) {
    if (n.type === 'text') out.push(n.text);
    else if (n.type === 'hardBreak') out.push('\n');
    else if (n.type === 'image' && n.attrs.alt) out.push(n.attrs.alt);
    else if ('content' in n) {
      walk(n.content, out);
      if (BLOCKS.has(n.type)) out.push('\n');
    }
  }
}

/** Texto plano (para buscador, extractos y emails). */
export function toPlainText(doc: Doc): string {
  const out: string[] = [];
  walk(doc.content, out);
  return out.join('').replace(/\n{3,}/g, '\n\n').trim();
}

/** Minutos de lectura (mínimo 1). */
export function readingTime(doc: Doc, wordsPerMinute = 230): number {
  const words = toPlainText(doc).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / wordsPerMinute));
}

/** Extracto de hasta `max` caracteres, cortado en palabra. */
export function excerpt(doc: Doc, max = 160): string {
  const t = toPlainText(doc).replace(/\s+/g, ' ');
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ') > max * 0.6 ? cut.lastIndexOf(' ') : cut.length)}…`;
}

export const slugifyHeading = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'section';

/**
 * Encabezados con ids únicos (los mismos que usan los renderizadores) para una tabla de contenidos. Recorre el árbol
 * entero en el mismo orden que `toHtml` y `RichText` (también los anidados en citas o listas), para que la numeración
 * de ids coincida.
 */
export function headings(doc: Doc, maxLevel = 3): Array<{ level: number; text: string; id: string }> {
  const used = new Map<string, number>();
  const out: Array<{ level: number; text: string; id: string }> = [];
  const visit = (nodes: Node[] | undefined): void => {
    for (const n of nodes ?? []) {
      if (n.type === 'heading') {
        const text = toPlainText({ type: 'doc', content: [n] });
        const base = slugifyHeading(text);
        const k = used.get(base) ?? 0;
        used.set(base, k + 1);
        if (n.attrs.level <= maxLevel) out.push({ level: n.attrs.level, text, id: k ? `${base}-${k}` : base });
      } else if ('content' in n) visit(n.content);
    }
  };
  visit(doc.content);
  return out;
}

/** Ids de encabezado en orden de aparición (todos los niveles), para que los renderizadores coincidan con `headings`. */
export function headingIds(doc: Doc): string[] {
  return headings(doc, 6).map((h) => h.id);
}
