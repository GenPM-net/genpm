// Generado por scripts/gen.mjs. No editar a mano.
// `en` va empaquetado; el resto de idiomas se carga bajo demanda (i18n §4.1).

import en_cli from '../locales/en/cli.json' with { type: 'json' };
import en_common from '../locales/en/common.json' with { type: 'json' };
import en_errors from '../locales/en/errors.json' with { type: 'json' };
import en_web from '../locales/en/web.json' with { type: 'json' };

export type Catalog = Record<string, unknown>;

export const EN: Record<string, Catalog> = {
  cli: en_cli,
  common: en_common,
  errors: en_errors,
  web: en_web,
};

export const LOADERS: Record<string, Record<string, () => Promise<Catalog>>> = {
  "de": {
    cli: () => import('../locales/de/cli.json', { with: { type: 'json' } }).then((m) => m.default as Catalog),
    common: () => import('../locales/de/common.json', { with: { type: 'json' } }).then((m) => m.default as Catalog),
    errors: () => import('../locales/de/errors.json', { with: { type: 'json' } }).then((m) => m.default as Catalog),
    web: () => import('../locales/de/web.json', { with: { type: 'json' } }).then((m) => m.default as Catalog),
  },
  "en-XA": {
    cli: () => import('../locales/en-XA/cli.json', { with: { type: 'json' } }).then((m) => m.default as Catalog),
    common: () => import('../locales/en-XA/common.json', { with: { type: 'json' } }).then((m) => m.default as Catalog),
    errors: () => import('../locales/en-XA/errors.json', { with: { type: 'json' } }).then((m) => m.default as Catalog),
    web: () => import('../locales/en-XA/web.json', { with: { type: 'json' } }).then((m) => m.default as Catalog),
  },
  "es": {
    cli: () => import('../locales/es/cli.json', { with: { type: 'json' } }).then((m) => m.default as Catalog),
    common: () => import('../locales/es/common.json', { with: { type: 'json' } }).then((m) => m.default as Catalog),
    errors: () => import('../locales/es/errors.json', { with: { type: 'json' } }).then((m) => m.default as Catalog),
    web: () => import('../locales/es/web.json', { with: { type: 'json' } }).then((m) => m.default as Catalog),
  },
  "fr": {
    cli: () => import('../locales/fr/cli.json', { with: { type: 'json' } }).then((m) => m.default as Catalog),
    common: () => import('../locales/fr/common.json', { with: { type: 'json' } }).then((m) => m.default as Catalog),
    errors: () => import('../locales/fr/errors.json', { with: { type: 'json' } }).then((m) => m.default as Catalog),
    web: () => import('../locales/fr/web.json', { with: { type: 'json' } }).then((m) => m.default as Catalog),
  },
  "ja": {
    cli: () => import('../locales/ja/cli.json', { with: { type: 'json' } }).then((m) => m.default as Catalog),
    common: () => import('../locales/ja/common.json', { with: { type: 'json' } }).then((m) => m.default as Catalog),
    errors: () => import('../locales/ja/errors.json', { with: { type: 'json' } }).then((m) => m.default as Catalog),
    web: () => import('../locales/ja/web.json', { with: { type: 'json' } }).then((m) => m.default as Catalog),
  },
  "ko": {
    cli: () => import('../locales/ko/cli.json', { with: { type: 'json' } }).then((m) => m.default as Catalog),
    common: () => import('../locales/ko/common.json', { with: { type: 'json' } }).then((m) => m.default as Catalog),
    errors: () => import('../locales/ko/errors.json', { with: { type: 'json' } }).then((m) => m.default as Catalog),
    web: () => import('../locales/ko/web.json', { with: { type: 'json' } }).then((m) => m.default as Catalog),
  },
  "pt-BR": {
    cli: () => import('../locales/pt-BR/cli.json', { with: { type: 'json' } }).then((m) => m.default as Catalog),
    common: () => import('../locales/pt-BR/common.json', { with: { type: 'json' } }).then((m) => m.default as Catalog),
    errors: () => import('../locales/pt-BR/errors.json', { with: { type: 'json' } }).then((m) => m.default as Catalog),
    web: () => import('../locales/pt-BR/web.json', { with: { type: 'json' } }).then((m) => m.default as Catalog),
  },
  "zh-CN": {
    cli: () => import('../locales/zh-CN/cli.json', { with: { type: 'json' } }).then((m) => m.default as Catalog),
    common: () => import('../locales/zh-CN/common.json', { with: { type: 'json' } }).then((m) => m.default as Catalog),
    errors: () => import('../locales/zh-CN/errors.json', { with: { type: 'json' } }).then((m) => m.default as Catalog),
    web: () => import('../locales/zh-CN/web.json', { with: { type: 'json' } }).then((m) => m.default as Catalog),
  },
};
