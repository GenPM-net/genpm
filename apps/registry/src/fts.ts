// Escapado de consultas FTS5 (api-spec §6): cada término entre comillas dobles (duplicando las internas) + `*`,
// sin operadores FTS, máximo 8 términos. Sinónimos curados por idioma → keyword canónica (i18n §4.6).

const OPERATORS = new Set(['and', 'or', 'not', 'near']);
const CJK = /[぀-ヿ㐀-䶿一-鿿가-힯]/;

export function isCjk(q: string): boolean {
  return CJK.test(q);
}

export function normalizeQuery(q: string): string {
  return q
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u0000-\u001f]/g, ' ')
    .trim()
    .slice(0, 100);
}

export function terms(q: string): string[] {
  return normalizeQuery(q)
    .split(/[\s:^*()"'{}[\],;+]+/)
    .map((t) => t.replace(/^-+/, ''))
    .filter((t) => t.length > 0 && !OPERATORS.has(t))
    .slice(0, 8);
}

/** Expresión MATCH segura. Para CJK (trigram) no se usa prefijo: cada término debe tener ≥ 3 caracteres. */
export function ftsMatch(
  q: string,
  synonyms: Record<string, readonly string[]> = {},
): { match: string; cjk: boolean } | null {
  const cjk = isCjk(q);
  const list = terms(q).flatMap((t) => {
    const canonical = Object.entries(synonyms).find(([, syns]) => syns.includes(t))?.[0];
    return canonical && canonical !== t ? [`(${quote(t, cjk)} OR ${quote(canonical, cjk)})`] : [quote(t, cjk)];
  });
  if (cjk) {
    const ok = terms(q).filter((t) => [...t].length >= 3);
    if (!ok.length) return null;
    return { match: ok.map((t) => quote(t, true)).join(' '), cjk };
  }
  return list.length ? { match: list.join(' '), cjk } : null;
}

function quote(t: string, cjk: boolean): string {
  return `"${t.replace(/"/g, '""')}"${cjk ? '' : '*'}`;
}

/** Clave de caché de búsqueda: minúsculas y términos ordenados (api-spec §2). */
export function searchCacheKey(q: string): string {
  return terms(q).sort().join(' ');
}
