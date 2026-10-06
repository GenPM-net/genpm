// Dinero en enteros (unidades menores) con moneda ISO 4217. Sin decimales flotantes en ningún cálculo.
import type { Money } from '../contracts/index.js';

export type { Money };

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyError';
  }
}

const decimalsCache = new Map<string, number>();

/** Decimales de la moneda según Intl (EUR 2, JPY 0, KWD 3). */
export function currencyDecimals(currency: string): number {
  let d = decimalsCache.get(currency);
  if (d === undefined) {
    if (!/^[A-Z]{3}$/.test(currency)) throw new MoneyError(`invalid currency: ${currency}`);
    d = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
    decimalsCache.set(currency, d);
  }
  return d;
}

export function money(amount: number, currency: string): Money {
  if (!Number.isSafeInteger(amount)) throw new MoneyError(`amount must be an integer of minor units: ${amount}`);
  currencyDecimals(currency);
  return { amount, currency };
}

export const zero = (currency: string) => money(0, currency);

/** Desde un importe decimal en texto (`"19.99"`, `"19,99"`) sin pasar por float. */
export function parseMoney(value: string, currency: string): Money {
  const d = currencyDecimals(currency);
  const m = /^\s*(-)?(\d+)(?:[.,](\d+))?\s*$/.exec(value);
  if (!m) throw new MoneyError(`invalid amount: ${value}`);
  const frac = (m[3] ?? '').padEnd(d, '0');
  if (frac.length > d && /[1-9]/.test(frac.slice(d))) throw new MoneyError(`too many decimals for ${currency}: ${value}`);
  const amount = Number(m[2]) * 10 ** d + Number(frac.slice(0, d) || '0');
  return money(m[1] ? -amount : amount, currency);
}

function same(a: Money, b: Money): void {
  if (a.currency !== b.currency) throw new MoneyError(`currency mismatch: ${a.currency} vs ${b.currency}`);
}

export const add = (a: Money, ...rest: Money[]): Money => rest.reduce((acc, b) => (same(acc, b), money(acc.amount + b.amount, acc.currency)), a);
export const sub = (a: Money, b: Money): Money => (same(a, b), money(a.amount - b.amount, a.currency));
export const sum = (items: Money[], currency: string): Money => items.reduce((acc, m) => add(acc, m), zero(currency));
export const isZero = (m: Money) => m.amount === 0;
export const isNegative = (m: Money) => m.amount < 0;
export const compare = (a: Money, b: Money) => (same(a, b), Math.sign(a.amount - b.amount));
export const max = (a: Money, b: Money) => (compare(a, b) >= 0 ? a : b);
export const min = (a: Money, b: Money) => (compare(a, b) <= 0 ? a : b);
export const equals = (a: Money, b: Money) => a.currency === b.currency && a.amount === b.amount;

/** Redondeo bancario opcional; por defecto "half away from zero" (el habitual en precios). */
function round(x: number, mode: 'half-up' | 'half-even'): number {
  const r = Math.round(Math.abs(x) * 1e6) / 1e6; // limpia ruido binario (19.999999999 → 20)
  const floor = Math.floor(r);
  const diff = r - floor;
  let out = diff > 0.5 ? floor + 1 : diff < 0.5 ? floor : mode === 'half-even' ? (floor % 2 === 0 ? floor : floor + 1) : floor + 1;
  if (x < 0) out = -out;
  return out === 0 ? 0 : out;
}

/** Multiplica por un factor (cantidades, tipos de IVA) y redondea a la unidad menor. */
export function multiply(m: Money, factor: number, mode: 'half-up' | 'half-even' = 'half-up'): Money {
  return money(round(m.amount * factor, mode), m.currency);
}

/** Porcentaje (`percent(m, 21)` = 21 %). */
export const percent = (m: Money, pct: number, mode?: 'half-up' | 'half-even') => multiply(m, pct / 100, mode);

/**
 * Reparte `m` en partes proporcionales a `ratios` sin perder ni crear céntimos (los restos van a las partes con mayor
 * resto). Útil para repartir un descuento entre líneas.
 */
export function allocate(m: Money, ratios: number[]): Money[] {
  if (!ratios.length || ratios.some((r) => r < 0 || !Number.isFinite(r))) throw new MoneyError('ratios must be non-negative numbers');
  const total = ratios.reduce((a, b) => a + b, 0);
  if (total === 0) return ratios.map((_, i) => money(i === 0 ? m.amount : 0, m.currency));
  const sign = m.amount < 0 ? -1 : 1;
  const abs = Math.abs(m.amount);
  const exact = ratios.map((r) => (abs * r) / total);
  const parts = exact.map(Math.floor);
  let rest = abs - parts.reduce((a, b) => a + b, 0);
  const order = exact.map((e, i) => ({ i, frac: e - Math.floor(e) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (rest <= 0) break;
    parts[i]!++;
    rest--;
  }
  return parts.map((p) => money(sign * p, m.currency));
}

/** Precio "psicológico": redondea hacia arriba a la unidad y aplica la terminación (`.99`, `.95`, `.00`). */
export function charmPrice(m: Money, ending: '.99' | '.95' | '.90' | '.00' = '.99'): Money {
  const d = currencyDecimals(m.currency);
  if (d === 0) return money(Math.ceil(m.amount / 10) * 10 - (ending === '.00' ? 0 : 1), m.currency);
  const unit = 10 ** d;
  const end = Math.round(Number(ending) * unit);
  const whole = Math.floor(m.amount / unit);
  const candidate = whole * unit + end;
  return money(candidate >= m.amount ? candidate : (whole + 1) * unit + end, m.currency);
}

/** Importe decimal como texto (`"19.99"`), para APIs y JSON-LD. */
export function toDecimalString(m: Money): string {
  const d = currencyDecimals(m.currency);
  const abs = Math.abs(m.amount);
  const s = d ? `${Math.floor(abs / 10 ** d)}.${String(abs % 10 ** d).padStart(d, '0')}` : String(abs);
  return m.amount < 0 ? `-${s}` : s;
}

/** Formato local: `format(money(1999,'EUR'), 'es-ES')` → `19,99 €`. */
export function format(m: Money, locale = 'en', opts: Intl.NumberFormatOptions = {}): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: m.currency, ...opts }).format(Number(toDecimalString(m)));
}

/** Conversión con una tabla de tipos `{ USD: 1.08 }` relativa a la moneda base de la tabla. */
export function convert(m: Money, to: string, rates: { base: string; rates: Record<string, number> }): Money {
  if (m.currency === to) return m;
  const rate = (c: string) => (c === rates.base ? 1 : rates.rates[c]);
  const from = rate(m.currency);
  const target = rate(to);
  if (!from || !target) throw new MoneyError(`no rate for ${m.currency} → ${to}`);
  const major = m.amount / 10 ** currencyDecimals(m.currency);
  return money(round((major / from) * target * 10 ** currencyDecimals(to), 'half-up'), to);
}
