// Los 15 bloques base. Un bloque nuevo = archivo nuevo + entrada aquí (o en `src/genpm/blocks.ts` si es del proyecto).
import { benefits } from './benefits.js';
import { comparison } from './comparison.js';
import { cta } from './cta.js';
import { faq } from './faq.js';
import { features } from './features.js';
import { form } from './form.js';
import { gallery } from './gallery.js';
import { guarantee } from './guarantee.js';
import { hero } from './hero.js';
import { logos } from './logos.js';
import { pricing } from './pricing.js';
import { richText } from './rich-text.js';
import { stats } from './stats.js';
import { testimonials } from './testimonials.js';
import { video } from './video.js';

export { benefits, comparison, cta, faq, features, form, gallery, guarantee, hero, logos, pricing, richText, stats, testimonials, video };
export { parseVideoUrl } from './video.js';

export const coreBlocks = [hero, features, benefits, testimonials, logos, pricing, faq, cta, gallery, video, stats, comparison, guarantee, richText, form];
