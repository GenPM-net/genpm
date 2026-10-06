import { describe, expect, it } from 'vitest';
import {
  add,
  allocate,
  charmPrice,
  convert,
  currencyDecimals,
  format,
  MoneyError,
  money,
  multiply,
  parseMoney,
  percent,
  sub,
  sum,
  toDecimalString,
} from './index.ts';

const eur = (n: number) => money(n, 'EUR');

describe('basics', () => {
  it('integers only, known currencies, no mixing', () => {
    expect(() => money(19.99, 'EUR')).toThrow(MoneyError);
    expect(() => money(1, 'eur')).toThrow(MoneyError);
    expect(() => add(eur(1), money(1, 'USD'))).toThrow(/mismatch/);
    expect(add(eur(1), eur(2), eur(3))).toEqual(eur(6));
    expect(sub(eur(5), eur(7))).toEqual(eur(-2));
    expect(sum([eur(1), eur(2)], 'EUR')).toEqual(eur(3));
    expect([currencyDecimals('EUR'), currencyDecimals('JPY'), currencyDecimals('KWD')]).toEqual([2, 0, 3]);
  });

  it('parses decimal strings without floats', () => {
    expect(parseMoney('19.99', 'EUR')).toEqual(eur(1999));
    expect(parseMoney('19,9', 'EUR')).toEqual(eur(1990));
    expect(parseMoney('0.10', 'EUR')).toEqual(eur(10));
    expect(parseMoney('1500', 'JPY')).toEqual(money(1500, 'JPY'));
    expect(parseMoney('1.234', 'KWD')).toEqual(money(1234, 'KWD'));
    expect(parseMoney('-3.5', 'EUR')).toEqual(eur(-350));
    expect(() => parseMoney('1.999', 'EUR')).toThrow(/decimals/);
    expect(() => parseMoney('abc', 'EUR')).toThrow();
  });

  it('formats and serializes', () => {
    expect(toDecimalString(eur(1999))).toBe('19.99');
    expect(toDecimalString(eur(-5))).toBe('-0.05');
    expect(toDecimalString(money(1500, 'JPY'))).toBe('1500');
    expect(format(eur(123456), 'es-ES').replace(/\s/g, ' ')).toBe('1234,56 €');
    expect(format(money(1999, 'USD'), 'en-US')).toBe('$19.99');
  });
});

describe('arithmetic', () => {
  it('multiplies and takes percentages with correct rounding', () => {
    expect(multiply(eur(1999), 3)).toEqual(eur(5997));
    expect(percent(eur(1000), 21)).toEqual(eur(210));
    expect(percent(eur(1), 50)).toEqual(eur(1)); // 0.5 → 1 (half-up)
    expect(percent(eur(1), 50, 'half-even')).toEqual(eur(0));
    expect(percent(eur(333), 10)).toEqual(eur(33));
    expect(multiply(eur(-5), 0.5)).toEqual(eur(-3));
    expect(multiply(eur(1005), 1.1)).toEqual(eur(1106)); // 1105.5 sin ruido binario
  });

  it('allocate never loses or creates cents (property check)', () => {
    let seed = 42;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let i = 0; i < 500; i++) {
      const amount = Math.floor(rnd() * 100000) - 20000;
      const ratios = Array.from({ length: 1 + Math.floor(rnd() * 6) }, () => Math.floor(rnd() * 50));
      const parts = allocate(eur(amount), ratios);
      expect(parts.reduce((a, p) => a + p.amount, 0)).toBe(amount);
      const total = ratios.reduce((a, b) => a + b, 0);
      if (total > 0) parts.forEach((p, k) => expect(Math.abs(p.amount - (amount * ratios[k]!) / total)).toBeLessThan(1));
    }
    expect(allocate(eur(100), [1, 1, 1]).map((m) => m.amount)).toEqual([34, 33, 33]);
    expect(allocate(eur(5), [0, 0]).map((m) => m.amount)).toEqual([5, 0]);
  });

  it('charm prices and currency conversion', () => {
    expect(charmPrice(eur(1720))).toEqual(eur(1799));
    expect(charmPrice(eur(1799))).toEqual(eur(1799));
    expect(charmPrice(eur(1800))).toEqual(eur(1899));
    expect(charmPrice(eur(1720), '.95')).toEqual(eur(1795));
    expect(charmPrice(eur(1720), '.00')).toEqual(eur(1800));
    expect(charmPrice(money(1234, 'JPY'))).toEqual(money(1239, 'JPY'));
    const rates = { base: 'EUR', rates: { USD: 1.08, JPY: 160 } };
    expect(convert(money(1080, 'USD'), 'EUR', rates)).toEqual(eur(1000));
    expect(convert(eur(1000), 'JPY', rates)).toEqual(money(1600, 'JPY'));
    expect(() => convert(eur(1), 'GBP', rates)).toThrow(/no rate/);
  });
});
