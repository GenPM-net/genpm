// Página de ejemplo con los 15 bloques (tests de render y de accesibilidad).
import type { BlockInstance } from '../define.js';

const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello rich text' }] }] };

/** Una página con los 15 bloques. */
export const allBlocks: BlockInstance[] = [
  { id: 'hero', type: 'hero', data: { eyebrow: 'New', title: 'Build faster', subtitle: 'Sub', image: 'med_hero', ctaLabel: 'Start', ctaHref: '/start', secondaryLabel: 'Docs', secondaryHref: 'https://docs.example.com' } },
  { id: 'features', type: 'features', data: { title: 'Features', columns: '3', items: [{ title: 'Fast', text: 'Very', icon: '⚡' }, { title: 'Safe' }] } },
  { id: 'benefits', type: 'benefits', data: { title: 'Benefits', image: 'med_benefit', items: [{ text: 'Saves time' }] } },
  { id: 'testimonials', type: 'testimonials', data: { title: 'What people say', items: [{ quote: 'Great', author: 'Ana', role: 'CTO', rating: 5, avatar: 'med_avatar' }] } },
  { id: 'logos', type: 'logos', data: { title: 'Trusted by', items: [{ name: 'Acme', image: 'med_logo', href: 'https://acme.test' }, { name: 'Globex' }] } },
  { id: 'pricing', type: 'pricing', data: { title: 'Pricing', plans: [{ name: 'Pro', price: '€19', period: 'month', features: 'A\nB\n', ctaLabel: 'Buy', ctaHref: '/buy', highlighted: true }], note: 'VAT included' } },
  { id: 'faq', type: 'faq', data: { title: 'FAQ', items: [{ question: 'Is it safe?', answer: 'Yes </script><script>alert(1)</script>' }] } },
  { id: 'cta', type: 'cta', data: { title: 'Ready?', ctaLabel: 'Go', ctaHref: '/go' } },
  { id: 'gallery', type: 'gallery', data: { title: 'Gallery', items: [{ image: 'med_g1', caption: 'One' }, { image: 'med_missing' }] } },
  { id: 'video', type: 'video', data: { title: 'Demo', url: 'https://youtu.be/dQw4w9WgXcQ' } },
  { id: 'stats', type: 'stats', data: { title: 'Numbers', items: [{ value: '10k', label: 'Users' }], source: 'Internal data, 2026' } },
  { id: 'comparison', type: 'comparison', data: { title: 'Compare', us: 'Us', them: 'Them', rows: [{ feature: 'Open source', us: 'yes', them: 'no' }] } },
  { id: 'guarantee', type: 'guarantee', data: { badge: '30 days', title: 'Guarantee', text: 'Money back', termsHref: '/terms' } },
  { id: 'text', type: 'rich-text', data: { doc } },
  { id: 'form', type: 'form', data: { title: 'Contact', formKey: 'contact' } },
];

const img = (id: string) => ({ src: `https://cdn.test/${id}.jpg`, alt: `Alt ${id}`, width: 800, height: 600 });
export const allMedia = Object.fromEntries(['med_hero', 'med_benefit', 'med_avatar', 'med_logo', 'med_g1'].map((id) => [id, img(id)]));
