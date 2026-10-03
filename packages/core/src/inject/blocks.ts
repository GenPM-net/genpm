// Bloques gestionados idempotentes (architecture §7.3): GenPM solo edita entre sus marcadores; nunca toca el resto.

export type BlockStyle = 'html' | 'hash';

function markers(id: string, style: BlockStyle): [string, string] {
  return style === 'html'
    ? [`<!-- genpm:${id}:start -->`, `<!-- genpm:${id}:end -->`]
    : [`# genpm:${id}:start`, `# genpm:${id}:end`];
}

/** Inserta o reemplaza el bloque; `null` lo elimina. Devuelve el texto nuevo (igual si no cambia nada). */
export function upsertBlock(text: string | null, id: string, body: string | null, style: BlockStyle = 'html'): string {
  const [start, end] = markers(id, style);
  const current = text ?? '';
  const s = current.indexOf(start);
  const e = s === -1 ? -1 : current.indexOf(end, s);
  const block = body === null ? '' : `${start}\n${body.replace(/\n+$/, '')}\n${end}`;
  if (s !== -1 && e !== -1) {
    const before = current.slice(0, s);
    const after = current.slice(e + end.length);
    if (block === '') return (before.replace(/\n+$/, '\n') + after.replace(/^\n+/, '')).replace(/^\n+/, '');
    return before + block + after;
  }
  if (block === '') return current;
  if (current === '') return `${block}\n`;
  return `${current.replace(/\n*$/, '\n\n')}${block}\n`;
}

export function hasBlock(text: string | null, id: string, style: BlockStyle = 'html'): boolean {
  if (!text) return false;
  const [start, end] = markers(id, style);
  const s = text.indexOf(start);
  return s !== -1 && text.indexOf(end, s) !== -1;
}
