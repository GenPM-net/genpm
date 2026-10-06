// Eventos de negocio que se miden (píxeles, tests A/B). Mismo `eventId` en navegador y servidor = deduplicación.
import { z } from 'zod';
import { MoneySchema } from './money.js';

const Item = z.strictObject({
  id: z.string().min(1).max(128),
  name: z.string().min(1).max(256),
  price: MoneySchema,
  quantity: z.number().int().positive(),
  variant: z.string().max(128).optional(),
  category: z.string().max(128).optional(),
});

const base = { eventId: z.string().min(8).max(64) };

export const CommerceEventSchema = z.discriminatedUnion('type', [
  z.strictObject({ ...base, type: z.literal('view_item'), items: z.array(Item).min(1), value: MoneySchema }),
  z.strictObject({ ...base, type: z.literal('add_to_cart'), items: z.array(Item).min(1), value: MoneySchema }),
  z.strictObject({ ...base, type: z.literal('begin_checkout'), items: z.array(Item).min(1), value: MoneySchema }),
  z.strictObject({
    ...base,
    type: z.literal('purchase'),
    orderId: z.string().min(1).max(128),
    items: z.array(Item).min(1),
    value: MoneySchema,
  }),
]);

export const LeadEventSchema = z.strictObject({
  ...base,
  type: z.literal('lead'),
  formKey: z.string().max(64).optional(),
  value: MoneySchema.optional(),
});

export const TrackedEventSchema = z.union([CommerceEventSchema, LeadEventSchema]);

export type CommerceItem = z.infer<typeof Item>;
export type CommerceEvent = z.infer<typeof CommerceEventSchema>;
export type LeadEvent = z.infer<typeof LeadEventSchema>;
export type TrackedEvent = z.infer<typeof TrackedEventSchema>;
