// "Contador real": solo con una fecha de fin verdadera; al pasar la fecha el bloque desaparece (nunca se reinicia).
import { z } from 'zod';
import { defineBlock, Section } from '@/lib/blocks';

const parts = (ms: number) => {
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return d > 0 ? `${d} days ${h} hours` : h > 0 ? `${h} hours ${m} minutes` : `${Math.max(m, 1)} minutes`;
};

export const countdown = defineBlock({
  type: 'countdown',
  label: 'Countdown (real deadline)',
  icon: 'clock',
  schema: z.object({
    title: z.string().trim().min(1).max(160),
    endsAt: z.coerce.date(),
    /** Qué termina de verdad (condiciones visibles). */
    terms: z.string().trim().min(1).max(300),
  }),
  fields: [
    { name: 'title', label: 'Title (e.g. "Launch price ends in")', type: 'text', required: true },
    { name: 'endsAt', label: 'Real end date and time', type: 'datetime', required: true, help: 'Must be the real end of the offer. Fake or resetting deadlines are illegal (EU Directive 2005/29/EC).' },
    { name: 'terms', label: 'What ends (shown to visitors)', type: 'text', required: true },
  ],
  defaults: () => ({ title: 'Offer ends in', terms: '' }),
  Component: ({ data, ctx }) => {
    const left = data.endsAt.getTime() - Date.now();
    if (left <= 0) return null;
    return (
      <Section id={ctx.id} block="countdown" title={data.title} ctx={ctx}>
        <p className="blk-countdown__time">
          <time dateTime={data.endsAt.toISOString()}>{parts(left)}</time>
        </p>
        <p className="blk__note">
          {data.terms} Ends {data.endsAt.toISOString().slice(0, 16).replace('T', ' ')} UTC.
        </p>
      </Section>
    );
  },
});
