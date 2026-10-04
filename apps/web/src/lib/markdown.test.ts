import { describe, expect, it } from 'vitest';
import { renderMarkdown, slugify } from './markdown.js';

describe('renderMarkdown (contenido no confiable)', () => {
  it('escapa el HTML crudo', () => {
    const html = renderMarkdown('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>');
    expect(html).not.toMatch(/<script|<img src=x/);
    expect(html).toContain('&lt;script&gt;');
  });

  it('descarta enlaces javascript: y data:', () => {
    const html = renderMarkdown('[a](javascript:alert(1)) [b](data:text/html,x)');
    expect(html).not.toContain('<a ');
    expect(html).not.toContain('javascript:');
  });

  it('marca los enlaces externos con rel="nofollow ugc noopener"', () => {
    const html = renderMarkdown('[gh](https://github.com/x) [docs](https://genpm.net/docs)');
    expect(html).toContain('<a href="https://github.com/x" rel="nofollow ugc noopener" target="_blank">gh</a>');
    expect(html).toContain('<a href="https://genpm.net/docs">docs</a>');
  });

  it('resuelve rutas relativas contra baseUrl y pasa las imágenes por el proxy', () => {
    const html = renderMarkdown('![logo](img/a.png) [src](src/index.ts)', {
      baseUrl: 'https://github.com/o/r/blob/abc/',
      rawBaseUrl: 'https://raw.githubusercontent.com/o/r/abc/',
    });
    expect(html).toContain(`/img?u=${encodeURIComponent('https://raw.githubusercontent.com/o/r/abc/img/a.png')}`);
    expect(html).toContain('href="https://github.com/o/r/blob/abc/src/index.ts"');
  });

  it('el modo trusted conserva el HTML (solo docs propias)', () => {
    expect(renderMarkdown('<kbd>K</kbd>', { trusted: true })).toContain('<kbd>K</kbd>');
  });

  it('recoge los encabezados con ids estables', () => {
    const headings: Array<{ depth: number; text: string; id: string }> = [];
    const html = renderMarkdown('## Integración rápida\n\n### Don’t', { headings });
    expect(headings.map((h) => h.id)).toEqual(['integracion-rapida', 'don-t']);
    expect(html).toContain('<h2 id="integracion-rapida">');
  });
});

describe('slugify', () => {
  it('solo deja letras, números y guiones', () => {
    expect(slugify('"><img src=x>Hola, Mundo!')).toBe('hola-mundo');
    expect(slugify('認証 の 設定')).toBe('認証-の-設定');
  });
});

describe('slugify for every locale', () => {
  it('strips Latin accents but keeps CJK and Hangul intact', () => {
    expect(slugify('6. Baja de la cuenta')).toBe('6-baja-de-la-cuenta');
    expect(slugify('6. Fermeture de votre compte')).toBe('6-fermeture-de-votre-compte');
    expect(slugify('6. 계정 해지')).toBe('6-계정-해지'.normalize('NFC'));
    expect(slugify('6. アカウントのデータ')).toBe('6-アカウントのデータ');
  });
});
