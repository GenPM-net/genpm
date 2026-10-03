import { describe, expect, it } from 'vitest';
import { href, splitLocale } from './i18n.js';

describe('splitLocale', () => {
  it('reconoce los prefijos de los 8 idiomas', () => {
    expect(splitLocale('/es/search')).toEqual({ locale: 'es', path: '/search' });
    expect(splitLocale('/pt-br')).toEqual({ locale: 'pt-BR', path: '/' });
    expect(splitLocale('/zh-cn/p/@core/auth')).toEqual({ locale: 'zh-CN', path: '/p/@core/auth' });
    expect(splitLocale('/ja/')).toEqual({ locale: 'ja', path: '/' });
  });

  it('sin prefijo conocido es inglés y conserva la ruta', () => {
    expect(splitLocale('/')).toEqual({ locale: 'en', path: '/' });
    expect(splitLocale('/docs/mcp')).toEqual({ locale: 'en', path: '/docs/mcp' });
    expect(splitLocale('/xx/search')).toEqual({ locale: 'en', path: '/xx/search' });
    expect(splitLocale('/en-xa/')).toEqual({ locale: 'en', path: '/en-xa/' });
  });
});

describe('href', () => {
  it('antepone el prefijo salvo en inglés', () => {
    expect(href('en', '/search')).toBe('/search');
    expect(href('es', '/search')).toBe('/es/search');
    expect(href('pt-BR', '/')).toBe('/pt-br');
    expect(href('zh-CN', '/mcp')).toBe('/zh-cn/mcp');
  });

  it('es la inversa de splitLocale', () => {
    for (const loc of ['en', 'es', 'pt-BR', 'fr', 'de', 'ja', 'zh-CN', 'ko'] as const) {
      expect(splitLocale(href(loc, '/p/@core/auth'))).toEqual({ locale: loc, path: '/p/@core/auth' });
    }
  });
});
