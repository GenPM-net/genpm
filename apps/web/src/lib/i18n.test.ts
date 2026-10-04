import { describe, expect, it } from 'vitest';
import { href, localizeLinks, splitLocale } from './i18n.js';

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

describe('localizeLinks', () => {
  it('lleva los enlaces internos al idioma actual y los deja relativos', () => {
    expect(localizeLinks('<a href="https://genpm.net/privacy#6-x">', 'ko')).toBe('<a href="/ko/privacy#6-x">');
    expect(localizeLinks('<a href="/docs/install">', 'es')).toBe('<a href="/es/docs/install">');
    expect(localizeLinks('<a href="https://genpm.net/">', 'en')).toBe('<a href="/">');
  });

  it('respeta los que ya llevan idioma, los estáticos y los externos', () => {
    expect(localizeLinks('<a href="https://genpm.net/es/docs/mcp">', 'es')).toBe('<a href="/es/docs/mcp">');
    expect(localizeLinks('<a href="https://genpm.net/schema/v1/genpm.json">', 'fr')).toBe(
      '<a href="/schema/v1/genpm.json">',
    );
    expect(localizeLinks('<a href="https://github.com/x">', 'de')).toBe('<a href="https://github.com/x">');
  });
});
