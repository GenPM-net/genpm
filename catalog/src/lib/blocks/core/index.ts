// Los 15 bloques base. Un bloque nuevo = archivo nuevo + entrada aquí (o en `src/genpm/blocks.ts` si es del proyecto).
import { benefits } from './benefits.ts';
import { comparison } from './comparison.ts';
import { cta } from './cta.ts';
import { faq } from './faq.ts';
import { features } from './features.ts';
import { form } from './form.ts';
import { gallery } from './gallery.ts';
import { guarantee } from './guarantee.ts';
import { hero } from './hero.ts';
import { logos } from './logos.ts';
import { pricing } from './pricing.ts';
import { richText } from './rich-text.ts';
import { stats } from './stats.ts';
import { testimonials } from './testimonials.ts';
import { video } from './video.ts';

export { benefits, comparison, cta, faq, features, form, gallery, guarantee, hero, logos, pricing, richText, stats, testimonials, video };
export { parseVideoUrl } from './video.ts';

export const coreBlocks = [hero, features, benefits, testimonials, logos, pricing, faq, cta, gallery, video, stats, comparison, guarantee, richText, form];
