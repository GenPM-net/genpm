// Catálogo de la portada: los paquetes agrupados por lo que resuelven. Los @core van por nombre; el resto, por sus
// keywords, y si nada encaja, a "Más paquetes". Orden: kits en su orden fijo, luego por instalaciones y nombre.
import type { SearchRow } from './registry.js';

export type GroupId = 'kits' | 'auth' | 'commerce' | 'content' | 'admin' | 'marketing' | 'base' | 'more';

export const GROUP_ORDER: GroupId[] = ['kits', 'auth', 'commerce', 'content', 'marketing', 'admin', 'base', 'more'];

const KITS = ['@core/kit-cms', '@core/kit-store', '@core/kit-blog', '@core/kit-landing', '@core/kit-dropshipping'];

const BY_NAME: Record<string, GroupId> = {
  '@core/auth': 'auth',
  '@core/rbac': 'auth',
  '@core/billing': 'commerce',
  '@core/stripe': 'commerce',
  '@core/checkout': 'commerce',
  '@core/cart': 'commerce',
  '@core/catalog': 'commerce',
  '@core/orders': 'commerce',
  '@core/shipping': 'commerce',
  '@core/discounts': 'commerce',
  '@core/pricing': 'commerce',
  '@core/reviews': 'commerce',
  '@core/invoices': 'commerce',
  '@core/suppliers': 'commerce',
  '@core/money': 'commerce',
  '@core/content': 'content',
  '@core/blog': 'content',
  '@core/blocks': 'content',
  '@core/media': 'content',
  '@core/rich-text': 'content',
  '@core/site': 'content',
  '@core/search': 'content',
  '@core/seo': 'content',
  '@core/comments': 'content',
  '@core/forms': 'marketing',
  '@core/newsletter': 'marketing',
  '@core/consent': 'marketing',
  '@core/pixels': 'marketing',
  '@core/experiments': 'marketing',
  '@core/antispam': 'marketing',
  '@core/admin': 'admin',
  '@core/ui': 'admin',
  '@core/db': 'base',
  '@core/email': 'base',
  '@core/jobs': 'base',
  '@core/storage': 'base',
  '@core/ai': 'base',
  '@core/contracts': 'base',
};

const BY_KEYWORD: Array<[GroupId, string[]]> = [
  ['auth', ['auth', 'login', 'oauth', 'sessions', 'permissions']],
  ['commerce', ['payments', 'stripe', 'billing', 'ecommerce', 'checkout']],
  ['content', ['cms', 'blog', 'content', 'seo', 'search']],
  ['marketing', ['forms', 'newsletter', 'analytics', 'marketing']],
  ['base', ['database', 'email', 'queue', 'storage', 'ai']],
];

export function groupOf(p: SearchRow): GroupId {
  if (KITS.includes(p.name) || (p.name.includes('/kit-') && p.keywords.includes('kit'))) return 'kits';
  const named = BY_NAME[p.name];
  if (named) return named;
  for (const [id, kws] of BY_KEYWORD) if (p.keywords.some((k) => kws.includes(k))) return id;
  return 'more';
}

/** Texto en minúsculas sobre el que filtra la portada: nombre, resumen y keywords. */
export const filterText = (p: SearchRow) => [p.name, p.summary, ...p.keywords].join(' ').toLowerCase();

export function groupPackages(rows: SearchRow[]): Array<{ id: GroupId; items: SearchRow[] }> {
  const rank = (p: SearchRow) => {
    const k = KITS.indexOf(p.name);
    return k >= 0 ? k : 100;
  };
  return GROUP_ORDER.map((id) => ({
    id,
    items: rows
      .filter((p) => groupOf(p) === id)
      .sort((a, b) => rank(a) - rank(b) || b.installs30d - a.installs30d || a.name.localeCompare(b.name)),
  })).filter((g) => g.items.length);
}
