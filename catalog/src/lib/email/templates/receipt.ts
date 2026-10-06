import { Heading, Section, Text } from '@react-email/components';
import { createElement as h } from 'react';
import { Layout, muted, text } from './layout.ts';

export type ReceiptProps = {
  number: string;
  /** Importes en unidades menores de la divisa (céntimos; yenes sin decimales; fils con 3) para no perder precisión. */
  items: Array<{ description: string; amount: number }>;
  currency: string;
  date: Date;
};

// Los decimales los marca la divisa (ISO 4217): JPY 0, EUR 2, KWD 3. Dividir siempre entre 100 mostraba ¥5 por ¥500.
const money = (minor: number, currency: string) => {
  const fmt = new Intl.NumberFormat('en', { style: 'currency', currency });
  return fmt.format(minor / 10 ** (fmt.resolvedOptions().maximumFractionDigits ?? 2));
};

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
