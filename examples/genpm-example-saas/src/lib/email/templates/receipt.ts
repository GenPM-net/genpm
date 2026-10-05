import { Heading, Section, Text } from '@react-email/components';
import { createElement as h } from 'react';
import { Layout, muted, text } from './layout.js';

export type ReceiptProps = {
  number: string;
  /** Importes en unidades menores (céntimos) para no perder precisión. */
  items: Array<{ description: string; amount: number }>;
  currency: string;
  date: Date;
};

const money = (minor: number, currency: string) =>
  new Intl.NumberFormat('en', { style: 'currency', currency }).format(minor / 100);

export const receipt = {
  subject: (p: ReceiptProps) => `Receipt ${p.number}`,
  render: (p: ReceiptProps) => {
    const total = p.items.reduce((n, i) => n + i.amount, 0);
    return h(
      Layout,
      { preview: `Receipt ${p.number} · ${money(total, p.currency)}` },
      h(Heading, { as: 'h1' }, `Receipt ${p.number}`),
      h(Text, { style: muted }, p.date.toISOString().slice(0, 10)),
      ...p.items.map((i) => h(Section, { key: i.description }, h(Text, { style: text }, `${i.description} — ${money(i.amount, p.currency)}`))),
      h(Text, { style: { ...text, fontWeight: 700 } }, `Total ${money(total, p.currency)}`),
    );
  },
};
