import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod';
import {
  type AdminResource,
  type ContentEntry,
  type ContentSource,
  defineAdminResource,
  defineSearchSource,
  defineSitemapSource,
  type Money,
  MoneySchema,
  type PaymentProvider,
  TrackedEventSchema,
} from './index.js';

const eur = (amount: number): Money => ({ amount, currency: 'EUR' });

describe('Money', () => {
  it('accepts integer minor units and ISO codes only', () => {
    expect(MoneySchema.safeParse(eur(1999)).success).toBe(true);
    expect(MoneySchema.safeParse({ amount: 19.99, currency: 'EUR' }).success).toBe(false);
    expect(MoneySchema.safeParse({ amount: 1, currency: 'eur' }).success).toBe(false);
  });
});

describe('TrackedEvent', () => {
  const item = { id: 'var_1', name: 'Mug', price: eur(1200), quantity: 2 };
  it('validates commerce and lead events', () => {
    expect(TrackedEventSchema.safeParse({ type: 'add_to_cart', eventId: 'evt_12345678', items: [item], value: eur(2400) }).success).toBe(true);
    expect(TrackedEventSchema.safeParse({ type: 'lead', eventId: 'evt_12345678', formKey: 'contact' }).success).toBe(true);
  });
  it('rejects purchases without order, unknown types and extra keys', () => {
    expect(TrackedEventSchema.safeParse({ type: 'purchase', eventId: 'evt_12345678', items: [item], value: eur(2400) }).success).toBe(false);
    expect(TrackedEventSchema.safeParse({ type: 'refund', eventId: 'evt_12345678' }).success).toBe(false);
    expect(TrackedEventSchema.safeParse({ type: 'lead', eventId: 'evt_12345678', email: 'a@b.c' }).success).toBe(false);
  });
});

describe('type contracts', () => {
  it('ContentSource is generic over entry data', () => {
    type Page = { title: string };
    const src: ContentSource = {
      getEntry: async () => null,
      listEntries: async () => [],
    };
    expectTypeOf(src.getEntry<Page>('pages', 'about')).resolves.toEqualTypeOf<ContentEntry<Page> | null>();
  });

  it('define helpers keep the inferred row type', async () => {
    type Row = { id: string; title: string };
    const r = defineAdminResource<Row>({
      name: 'notes',
      label: { singular: 'Note', plural: 'Notes' },
      fields: [{ name: 'title', label: 'Title', type: 'text', required: true, list: true }],
      input: z.object({ title: z.string() }),
      title: (row) => row.title,
      list: async () => ({ rows: [{ id: 'n1', title: 'Hi' }], total: 1 }),
      get: async (id) => ({ id, title: 'Hi' }),
    });
    expectTypeOf(r).toEqualTypeOf<AdminResource<Row>>();
    const ctx = { user: { id: 'usr_1', email: null, name: null }, can: async () => true };
    expect((await r.list({ page: 1, pageSize: 10 }, ctx)).total).toBe(1);

    const sm = defineSitemapSource({ name: 'pages', async *urls() { yield { loc: '/' }; } });
    const urls = [];
    for await (const u of sm.urls()) urls.push(u.loc);
    expect(urls).toEqual(['/']);
    const ss = defineSearchSource({ type: 'page', async *documents() {} });
    expect(ss.type).toBe('page');
  });

  it('PaymentProvider refunds take an idempotency key', () => {
    expectTypeOf<Parameters<PaymentProvider['refund']>[2]>().toHaveProperty('idempotencyKey');
  });
});
