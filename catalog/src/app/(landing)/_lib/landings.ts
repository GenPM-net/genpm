// Colección `landings` sobre @core/content: bloques, SEO, diseño, objetivo de conversión y página de gracias.
import { z } from 'zod';
import { blocks } from '@/genpm/blocks';
import { defineCollection } from '@/lib/content';
import { SeoFieldsSchema, seoAdminFields } from '@/lib/seo';

export const LANDING_PREFIX = '/lp';
export const landingPath = (e: { slug: string }) => `${LANDING_PREFIX}/${e.slug}`;

export const LandingSchema = z.object({
  title: z.string().min(1).max(160),
  blocks: blocks.schema.default([]),
  /** `minimal`: sin cabecera ni pie del sitio (menos distracciones). */
  layout: z.enum(['full', 'minimal']).default('minimal'),
  /** Qué cuenta como conversión. `lead`: un envío de formulario desde la landing. */
  goal: z.enum(['lead', 'click']).default('lead'),
  thanksTitle: z.string().max(160).default('Thank you!'),
  thanksText: z.string().max(2000).default('We have received your details and will get back to you soon.'),
  seo: SeoFieldsSchema,
});
export type LandingData = z.infer<typeof LandingSchema>;

export const landings = defineCollection('landings', {
  label: { singular: 'Landing page', plural: 'Landing pages' },
  schema: LandingSchema,
  localized: false,
  fields: [
    { name: 'title', label: 'Internal title', type: 'text', required: true, list: true },
    blocks.field('blocks', 'Sections'),
    {
      name: 'layout',
      label: 'Layout',
      type: 'select',
      options: [
        { value: 'minimal', label: 'Minimal (no site header/footer)' },
        { value: 'full', label: 'Full site layout' },
      ],
    },
    { name: 'goal', label: 'Conversion goal', type: 'select', list: true, options: [{ value: 'lead', label: 'Lead (form submission)' }, { value: 'click', label: 'Click on a call to action' }] },
    { name: 'thanksTitle', label: 'Thank-you page title', type: 'text' },
    { name: 'thanksText', label: 'Thank-you page text', type: 'textarea' },
    ...seoAdminFields,
  ],
});
