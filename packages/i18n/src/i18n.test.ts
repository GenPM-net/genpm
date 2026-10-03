import { describe, expect, it } from 'vitest';
import { createT, createTSync, en, errorText, format, loadCatalogs } from './index.js';
import { fallbackChain, fromUrlPrefix, isBeta, urlPrefix } from './locales.js';
import { match, negotiateAcceptLanguage, normalizeTag, resolveCliLocale } from './negotiate.js';

describe('createT', () => {
  it('translates with typed params and ICU plurals', async () => {
    const es = await createT('es');
    expect(es.t('errors.E_DRIFT.message', { name: '@core/auth', count: 1 })).toBe(
      '@core/auth tiene cambios locales en 1 archivo.',
    );
    expect(es.t('errors.E_DRIFT.message', { name: '@core/auth', count: 3 })).toBe(
      '@core/auth tiene cambios locales en 3 archivos.',
    );
    expect(en.t('errors.E_DRIFT.message', { name: '@core/auth', count: 3 })).toBe(
      '@core/auth has local changes in 3 files.',
    );
    expect(es.t('common.layers.connections')).toBe('Conexiones');
  });
  it('falls back to en for missing locales and keys', async () => {
    const fr = await createT('fr-CA', ['common']);
    expect(fr.t('common.layers.code')).toBe('Code');
    const tr = createTSync('es', { es: { common: { layers: {} } }, en: { common: { layers: { code: 'Code' } } } });
    expect(tr.t('common.layers.code')).toBe('Code');
    expect(tr.raw('common.nope')).toBe('common.nope');
    expect(tr.has('common.layers.code')).toBe(true);
    expect(tr.has('nope.x')).toBe(false);
  });
  it('returns raw text when a message does not compile', () => {
    const tr = createTSync('en', { en: { x: { bad: 'oops {' } } });
    expect(tr.raw('x.bad')).toBe('oops {');
    expect(tr.raw('x.bad')).toBe('oops {');
  });
  it('loads only requested namespaces', async () => {
    const cats = await loadCatalogs('es', ['common']);
    expect(Object.keys(cats['es'] ?? {})).toEqual(['common']);
  });
  it('builds error texts', () => {
    expect(errorText(en, 'E_DEST_CONFLICT', { path: 'src/lib/auth' })).toEqual({
      message: 'src/lib/auth exists and is not empty.',
      fix: 'Use --dest <dir> or --force (backs up first).',
    });
  });
});

describe('negotiation', () => {
  it('normalizes POSIX and BCP 47 tags', () => {
    expect(normalizeTag('es_ES.UTF-8')).toBe('es-ES');
    expect(normalizeTag('pt_br')).toBe('pt-BR');
    expect(normalizeTag('zh_hans_cn')).toBe('zh-Hans-CN');
    expect(normalizeTag('C')).toBe('en');
    expect(normalizeTag('de_DE@euro')).toBe('de-DE');
  });
  it('matches the closest supported locale', () => {
    expect(match('es-MX')).toBe('es');
    expect(match('pt-PT')).toBe('pt-BR');
    expect(match('zh-Hans-CN')).toBe('zh-CN');
    expect(match('zh-TW')).toBeNull();
    expect(match('it')).toBeNull();
    expect(match('')).toBeNull();
    expect(match('en-XA', ['en', 'en-XA'])).toBe('en-XA');
  });
  it('parses Accept-Language with q-values', () => {
    expect(negotiateAcceptLanguage('it;q=1, es-MX;q=0.9, en;q=0.8')).toBe('es');
    expect(negotiateAcceptLanguage('fr-CH, fr;q=0.9')).toBe('fr');
    expect(negotiateAcceptLanguage('*')).toBe('en');
    expect(negotiateAcceptLanguage('ko;q=0, ja;q=0.5')).toBe('ja');
    expect(negotiateAcceptLanguage('xx;q=abc')).toBe('en');
    expect(negotiateAcceptLanguage(undefined)).toBe('en');
  });
  it('resolves the CLI locale in priority order', () => {
    expect(resolveCliLocale({ flag: 'pt-BR', env: { GENPM_LANG: 'es' } })).toEqual({ locale: 'pt-BR', source: 'flag' });
    expect(resolveCliLocale({ env: { GENPM_LANG: 'es', LANG: 'de_DE.UTF-8' } })).toEqual({
      locale: 'es',
      source: 'GENPM_LANG',
    });
    expect(resolveCliLocale({ rcLang: 'ja', env: { LANG: 'de_DE.UTF-8' } })).toEqual({
      locale: 'ja',
      source: '.genpmrc',
    });
    expect(resolveCliLocale({ env: { LC_ALL: 'ko_KR.UTF-8', LANG: 'de' } })).toEqual({
      locale: 'ko',
      source: 'LC_ALL',
    });
    expect(resolveCliLocale({ env: { LC_MESSAGES: 'fr_FR' } })).toEqual({ locale: 'fr', source: 'LC_MESSAGES' });
    expect(resolveCliLocale({ env: { LANG: 'it_IT' }, system: 'es-AR' })).toEqual({ locale: 'es', source: 'system' });
    expect(resolveCliLocale({})).toEqual({ locale: 'en', source: 'default' });
    expect(resolveCliLocale({ flag: 'en-XA' }).locale).toBe('en-XA');
  });
});

describe('locales', () => {
  it('computes fallback chains, url prefixes and beta flags', () => {
    expect(fallbackChain('pt-BR')).toEqual(['pt-BR', 'pt', 'en']);
    expect(fallbackChain('en')).toEqual(['en']);
    expect(urlPrefix('en')).toBe('');
    expect(urlPrefix('zh-CN')).toBe('/zh-cn');
    expect(fromUrlPrefix('pt-br')).toBe('pt-BR');
    expect(fromUrlPrefix('en')).toBeNull();
    expect(fromUrlPrefix('xx')).toBeNull();
    expect(isBeta('ja')).toBe(true);
    expect(isBeta('es')).toBe(false);
  });
});

describe('format', () => {
  it('formats numbers, bytes and durations with Intl', () => {
    expect(format.compact('en', 1500)).toBe('1.5K');
    expect(format.compact('es', 1500)).toMatch(/1,5\s?mil/);
    expect(format.number('de', 1234.5)).toBe('1.234,5');
    expect(format.bytes('en', 512)).toBe('512 byte');
    expect(format.bytes('en', 112 * 1024)).toBe('112 kB');
    expect(format.bytes('en', 3.5 * 1024 * 1024)).toBe('3.5 MB');
    expect(format.duration('en', 320)).toBe('320 ms');
    expect(format.duration('en', 1800)).toBe('1.8 sec');
    expect(format.duration('en', 120_000)).toBe('2 min');
  });
  it('formats relative times, lists and dates', () => {
    const now = Date.UTC(2026, 9, 3);
    expect(format.relativeTime('en', now - 3 * 86_400_000, now)).toBe('3 days ago');
    expect(format.relativeTime('es', now - 3 * 86_400_000, new Date(now))).toBe('hace 3 días');
    expect(format.relativeTime('en', new Date(now - 30_000), now)).toBe('30 seconds ago');
    expect(format.relativeTime('en', now - 400 * 86_400_000, now)).toBe('last year');
    expect(format.list('es', ['a', 'b', 'c'])).toBe('a, b y c');
    expect(format.date('en', now)).toBe('Oct 3, 2026');
  });
});

describe('robustness', () => {
  it('never throws when ICU params are missing', () => {
    expect(en.raw('errors.E_BAD_REQUEST.message')).toBe('The request is invalid: {detail}');
    expect(en.raw('errors.E_DRIFT.message', { name: '@a/b' })).toBe('@a/b has local changes in {count}.');
  });
});
