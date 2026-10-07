// Páginas legales de comercio electrónico como BORRADORES con la estructura habitual y un aviso de revisión.
// Nunca se publican solas ni contienen texto legal inventado: el titular las completa y revisa con un profesional.
import { createEntry } from '@/lib/content';
import { getDb } from '@/lib/db';
import type { AdminWidget } from '@/lib/admin';
import { contentEntries } from '@/lib/content';
import { and, eq, inArray, ne } from 'drizzle-orm';

export const LEGAL_PAGES = [
  { slug: 'terms', title: 'Terms of sale', sections: ['Seller identification', 'Products and prices (taxes included)', 'Ordering process', 'Payment', 'Delivery', 'Right of withdrawal', 'Legal guarantee (2 years in the EU)', 'Complaints and online dispute resolution', 'Applicable law'] },
  { slug: 'shipping', title: 'Shipping', sections: ['Destinations', 'Costs', 'Delivery times', 'Tracking', 'Failed deliveries'] },
  { slug: 'returns', title: 'Returns and withdrawal', sections: ['14-day right of withdrawal (EU consumers)', 'How to withdraw (model withdrawal form)', 'Return costs', 'Refund timing and method', 'Exceptions'] },
  { slug: 'privacy', title: 'Privacy policy', sections: ['Controller', 'Data we collect and why', 'Legal basis', 'Recipients (payments, shipping, email, analytics)', 'International transfers', 'Retention', 'Your rights', 'Contact'] },
  { slug: 'cookies', title: 'Cookie policy', sections: ['What cookies are', 'Cookies we use (necessary, analytics, marketing)', 'How to change your choice'] },
] as const;

const doc = (sections: readonly string[]) => ({
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'PENDING REVIEW: this page is a template. Complete it with your real details and have it reviewed by a legal professional before publishing.' }] },
    ...sections.flatMap((s) => [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: s }] },
      { type: 'paragraph', content: [{ type: 'text', text: '[To be completed]' }] },
    ]),
  ],
});

/** Crea las páginas legales que falten como BORRADORES (nunca publica; `seedEntry` sí lo haría). Idempotente. */
export async function seedLegalPages(): Promise<string[]> {
  const created: string[] = [];
  for (const p of LEGAL_PAGES) {
    const [existing] = await getDb()
      .select({ id: contentEntries.id })
      .from(contentEntries)
      .where(and(eq(contentEntries.collection, 'pages'), eq(contentEntries.slug, p.slug)));
    if (existing) continue;
    await createEntry({ collection: 'pages', slug: p.slug, data: { title: p.title, blocks: [{ id: 'legal', type: 'rich-text', data: { doc: doc(p.sections), width: 'narrow' } }], seo: { noindex: true } } });
    created.push(p.slug);
  }
  return created;
}

/** Aviso del panel mientras alguna página legal siga sin publicar (= sin revisar). */
export const legalPagesWidget: AdminWidget = {
  name: 'legal-pending',
  title: 'Legal pages pending review',
  permission: 'pages:read',
  async load() {
    const rows = await getDb()
      .select({ slug: contentEntries.slug, id: contentEntries.id })
      .from(contentEntries)
      .where(and(eq(contentEntries.collection, 'pages'), inArray(contentEntries.slug, LEGAL_PAGES.map((p) => p.slug)), ne(contentEntries.status, 'published')));
    return { rows: rows.map((r) => ({ label: `/${r.slug}`, value: 'draft', href: `/admin/pages/${r.id}` })) };
  },
};

