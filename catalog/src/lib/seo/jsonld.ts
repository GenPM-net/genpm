// Datos estructurados schema.org (JSON-LD). `jsonLdScript` escapa para incrustar en <script> sin riesgo de XSS.
import type { Money } from '../contracts/index.ts';
import type { SiteSettings } from '../site/index.ts';
import { absoluteUrl, siteUrl } from './url.ts';

type Thing = Record<string, unknown>;

const ctx = (o: Thing): Thing => ({ '@context': 'https://schema.org', ...o });
const amount = (m: Money) => {
  const digits = new Intl.NumberFormat('en', { style: 'currency', currency: m.currency }).resolvedOptions().maximumFractionDigits ?? 2;
  return (m.amount / 10 ** digits).toFixed(digits);
};

export const jsonLd = {
  organization(s: SiteSettings): Thing {
    return ctx({
      '@type': 'Organization',
      name: s.name,
      url: siteUrl().toString(),
      ...(s.logo && { logo: absoluteUrl(s.logo) }),
      ...(s.contactEmail && { email: s.contactEmail }),
      ...(s.phone && { telephone: s.phone }),
      ...(s.social.length && { sameAs: s.social.map((x) => x.url) }),
    });
  },
  /** Con `searchPath` (`/search?q=`) añade la caja de búsqueda de Google. */
  website(s: SiteSettings, searchPath?: string): Thing {
    return ctx({
      '@type': 'WebSite',
      name: s.name,
      url: siteUrl().toString(),
      ...(searchPath && {
        potentialAction: { '@type': 'SearchAction', target: `${absoluteUrl(searchPath)}{search_term_string}`, 'query-input': 'required name=search_term_string' },
      }),
    });
  },
  breadcrumbs(items: Array<{ name: string; path: string }>): Thing {
    return ctx({
      '@type': 'BreadcrumbList',
      itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: absoluteUrl(it.path) })),
    });
  },
  article(a: { title: string; path: string; description?: string; image?: string; author?: string; publishedAt: Date; modifiedAt?: Date; publisher?: SiteSettings }): Thing {
    return ctx({
      '@type': 'BlogPosting',
      headline: a.title,
      url: absoluteUrl(a.path),
      ...(a.description && { description: a.description }),
      ...(a.image && { image: absoluteUrl(a.image) }),
      ...(a.author && { author: { '@type': 'Person', name: a.author } }),
      datePublished: a.publishedAt.toISOString(),
      dateModified: (a.modifiedAt ?? a.publishedAt).toISOString(),
      ...(a.publisher && { publisher: { '@type': 'Organization', name: a.publisher.name, ...(a.publisher.logo && { logo: absoluteUrl(a.publisher.logo) }) } }),
    });
  },
  product(p: {
    name: string;
    path: string;
    description?: string;
    images?: string[];
    sku?: string;
    brand?: string;
    price: Money;
    availability: 'InStock' | 'OutOfStock' | 'PreOrder' | 'BackOrder';
    rating?: { average: number; count: number };
  }): Thing {
    return ctx({
      '@type': 'Product',
      name: p.name,
      url: absoluteUrl(p.path),
      ...(p.description && { description: p.description }),
      ...(p.images?.length && { image: p.images.map((i) => absoluteUrl(i)) }),
      ...(p.sku && { sku: p.sku }),
      ...(p.brand && { brand: { '@type': 'Brand', name: p.brand } }),
      offers: {
        '@type': 'Offer',
        url: absoluteUrl(p.path),
        price: amount(p.price),
        priceCurrency: p.price.currency,
        availability: `https://schema.org/${p.availability}`,
      },
      // Solo con reseñas reales: nunca inventar valoraciones.
      ...(p.rating && p.rating.count > 0 && {
        aggregateRating: { '@type': 'AggregateRating', ratingValue: p.rating.average.toFixed(1), reviewCount: p.rating.count },
      }),
    });
  },
  faq(items: Array<{ question: string; answer: string }>): Thing {
    return ctx({
      '@type': 'FAQPage',
      mainEntity: items.map((i) => ({ '@type': 'Question', name: i.question, acceptedAnswer: { '@type': 'Answer', text: i.answer } })),
    });
  },
};

/** JSON para `<script type="application/ld+json">`: escapa `<`, `>`, `&` y separadores de línea. */
export function jsonLdScript(data: Thing | Thing[]): string {
  return JSON.stringify(data)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026')
    .replaceAll(' ', '\\u2028')
    .replaceAll(' ', '\\u2029');
}
