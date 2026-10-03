// Generado por scripts/gen.mjs. No editar a mano.
// `en` va empaquetado; el resto de idiomas se carga bajo demanda (i18n §4.1).

import en_common from '../locales/en/common.json' with { type: 'json' };
import en_errors from '../locales/en/errors.json' with { type: 'json' };

export type Catalog = Record<string, unknown>;

export const EN: Record<string, Catalog> = {
  common: en_common,
  errors: en_errors,
};

export const LOADERS: Record<string, Record<string, () => Promise<Catalog>>> = {
  "en-XA": {
    common: () => import('../locales/en-XA/common.json', { with: { type: 'json' } }).then((m) => m.default as Catalog),
    errors: () => import('../locales/en-XA/errors.json', { with: { type: 'json' } }).then((m) => m.default as Catalog),
  },
  "es": {
    common: () => import('../locales/es/common.json', { with: { type: 'json' } }).then((m) => m.default as Catalog),
    errors: () => import('../locales/es/errors.json', { with: { type: 'json' } }).then((m) => m.default as Catalog),
  },
};
