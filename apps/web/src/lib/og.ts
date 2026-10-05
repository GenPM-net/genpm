// Imágenes Open Graph (1200×630) generadas en el Worker con workers-og (satori + resvg empaquetados para Cloudflare
// Workers). Mismo diseño que public/og/home.png: wordmark, título en JetBrains Mono, subtítulo y chips de capas.
import { ImageResponse } from 'workers-og';
import bold from '../assets/og/jbm-bold.bin';
import regular from '../assets/og/jbm-regular.bin';

type Node = { type: string; props: Record<string, unknown> & { children?: unknown } };
const h = (type: string, style: Record<string, unknown>, children?: unknown): Node => ({
  type,
  props: { style, children },
});

const INK = '#0B0D11';
const MUTED = '#5B6270';
const LAYER = { code: '#549800', context: '#5B4FD9', mcp: '#127A86' } as const;

function chip(label: string, color: string): Node {
  return h(
    'div',
    {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '12px 20px',
      border: '2px solid #E8EBEF',
      borderRadius: 6,
      fontSize: 22,
      color: INK,
    },
    [h('div', { width: 14, height: 14, background: color }), label],
  );
}

export type OgInput = { eyebrow?: string; title: string; subtitle?: string; chips?: Array<keyof typeof LAYER> };

export function renderOg(input: OgInput, headers: Record<string, string> = {}): Response {
  const titleSize = input.title.length > 28 ? 64 : input.title.length > 18 ? 80 : 96;
  return new ImageResponse(
    h(
      'div',
      {
        width: 1200,
        height: 630,
        display: 'flex',
        flexDirection: 'column',
        background: '#FFFFFF',
        padding: '72px',
        fontFamily: 'JBM',
        border: '1px solid #E8EBEF',
      },
      [
        h(
          'div',
          {
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            fontSize: 40,
            fontWeight: 800,
            color: INK,
            letterSpacing: -2,
          },
          ['genpm', h('div', { width: 18, height: 36, background: LAYER.code, marginLeft: 2 })],
        ),
        h(
          'div',
          { display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center', gap: 20 },
          [
            input.eyebrow ? h('div', { fontSize: 26, color: MUTED }, input.eyebrow) : null,
            h(
              'div',
              { fontSize: titleSize, fontWeight: 800, color: INK, letterSpacing: -3, lineHeight: 1.05 },
              input.title,
            ),
            input.subtitle
              ? h(
                  'div',
                  { fontSize: 30, color: MUTED, lineHeight: 1.45, maxWidth: 1000 },
                  input.subtitle.length > 140 ? `${input.subtitle.slice(0, 139)}…` : input.subtitle,
                )
              : null,
          ].filter(Boolean),
        ),
        h(
          'div',
          { display: 'flex', gap: 22 },
          (input.chips ?? ['code', 'context', 'mcp']).map((c) =>
            chip(c === 'code' ? 'Code' : c === 'context' ? 'Context' : 'Connections', LAYER[c]),
          ),
        ),
      ],
    ) as never,
    {
      width: 1200,
      height: 630,
      headers,
      fonts: [
        { name: 'JBM', data: regular, weight: 400, style: 'normal' },
        { name: 'JBM', data: bold, weight: 800, style: 'normal' },
      ],
    },
  );
}
