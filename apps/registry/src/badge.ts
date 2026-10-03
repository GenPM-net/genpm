// Badges SVG estilo shields (api-spec §4.9, branding §11). Siempre en inglés (i18n §3: se incrustan en READMEs).
// Colores desde docs/design/tokens.json: etiqueta `genpm` sobre ink; valor sobre code (#549800) con texto ink;
// installs sobre wash; mcp con texto blanco; verified sobre code con ✓.

export type BadgeKind = 'version' | 'installs' | 'mcp' | 'verified';

const COLORS = {
  ink: '#0B0D11',
  paper: '#FFFFFF',
  wash: '#F6F7F9',
  code: '#549800',
  mcp: '#087584',
  line: '#E6E8EC',
} as const;

/** Ancho aproximado de Verdana 11 px (métrica usada por shields). */
function textWidth(s: string): number {
  let w = 0;
  for (const ch of s) w += /[ilj.,:;|!'1]/.test(ch) ? 3.6 : /[mwMW@]/.test(ch) ? 9.5 : /[A-Z0-9]/.test(ch) ? 7.4 : 6.6;
  return Math.ceil(w);
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function badgeSvg(label: string, value: string, kind: BadgeKind): string {
  const bg = kind === 'installs' ? COLORS.wash : kind === 'mcp' ? COLORS.mcp : COLORS.code;
  const fg = kind === 'mcp' ? COLORS.paper : COLORS.ink;
  const lw = textWidth(label) + 12;
  const vw = textWidth(value) + 12;
  const w = lw + vw;
  const title = esc(`${label}: ${value}`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${title}"><title>${title}</title><clipPath id="r"><rect width="${w}" height="20" rx="3"/></clipPath><g clip-path="url(#r)"><rect width="${lw}" height="20" fill="${COLORS.ink}"/><rect x="${lw}" width="${vw}" height="20" fill="${bg}"/>${kind === 'installs' ? `<rect x="${lw}" y="0.5" width="${vw - 0.5}" height="19" fill="none" stroke="${COLORS.line}"/>` : ''}</g><g font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11" text-rendering="geometricPrecision"><text x="${lw / 2}" y="14" fill="${COLORS.paper}" text-anchor="middle">${esc(label)}</text><text x="${lw + vw / 2}" y="14" fill="${fg}" text-anchor="middle">${esc(value)}</text></g></svg>`;
}

export function compactCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, '')}k`;
  return String(n);
}
