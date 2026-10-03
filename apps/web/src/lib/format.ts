import { format } from '@genpm/i18n';

export const compact = (locale: string, n: number) => format.compact(locale, n);
export const bytes = (locale: string, n: number) => format.bytes(locale, n);
export const ago = (locale: string, iso: string | null) => (iso ? format.relativeTime(locale, Date.parse(iso)) : '');
export const shortSha = (c: string) => c.slice(0, 7);

/** Sparkline SVG inline (sin librería). */
export function sparkline(data: number[], w = 80, h = 20): string {
  const d = data.length > 1 ? data : [0, ...data, 0].slice(-2);
  const max = Math.max(...d);
  const min = Math.min(...d);
  const n = d.length;
  const pts = d.map((v, i) => [
    ((i / (n - 1)) * (w - 4) + 2).toFixed(1),
    (h - 2 - ((v - min) / (max - min || 1)) * (h - 4)).toFixed(1),
  ]);
  const line = pts.map((p) => p.join(',')).join(' ');
  const last = pts[n - 1]!;
  const area = `M${pts.map((p) => p.join(' ')).join(' L')} L${last[0]} ${h} L${pts[0]![0]} ${h}Z`;
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><path d="${area}" fill="var(--wash)"/><polyline points="${line}" fill="none" stroke="var(--ink)" stroke-width="1.2"/><circle cx="${last[0]}" cy="${last[1]}" r="2" fill="var(--code)"/></svg>`;
}
