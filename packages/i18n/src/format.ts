// Formateo siempre con Intl, nunca concatenando números o fechas a mano (i18n §4.1).

export function number(locale: string, n: number, opts?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(locale, opts).format(n);
}

/** `1500` → `1.5K` (en), `1,5 mil` (es). */
export function compact(locale: string, n: number): string {
  return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

const UNITS = ['byte', 'kilobyte', 'megabyte', 'gigabyte'] as const;

/** Bytes en base 1024 con la unidad localizada (`112 kB`). */
export function bytes(locale: string, n: number): string {
  let value = n;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: UNITS[unit],
    unitDisplay: 'short',
    maximumFractionDigits: unit === 0 ? 0 : 1,
  }).format(value);
}

/** Duración en milisegundos → `1.8 s`, `320 ms`, `2 min`. */
export function duration(locale: string, ms: number): string {
  if (ms < 1000)
    return new Intl.NumberFormat(locale, { style: 'unit', unit: 'millisecond', unitDisplay: 'short' }).format(
      Math.round(ms),
    );
  if (ms < 60_000) {
    return new Intl.NumberFormat(locale, {
      style: 'unit',
      unit: 'second',
      unitDisplay: 'short',
      maximumFractionDigits: 1,
    }).format(ms / 1000);
  }
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: 'minute',
    unitDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(ms / 60_000);
}

const DIVISIONS: Array<[number, Intl.RelativeTimeFormatUnit]> = [
  [60, 'second'],
  [60, 'minute'],
  [24, 'hour'],
  [7, 'day'],
  [4.34524, 'week'],
  [12, 'month'],
  [Number.POSITIVE_INFINITY, 'year'],
];

/** Fecha relativa: `3 days ago`, `hace 3 días`. */
export function relativeTime(locale: string, date: Date | number, now: Date | number = Date.now()): string {
  let delta =
    ((typeof date === 'number' ? date : date.getTime()) - (typeof now === 'number' ? now : now.getTime())) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  for (const [amount, unit] of DIVISIONS) {
    if (Math.abs(delta) < amount) return rtf.format(Math.round(delta), unit);
    delta /= amount;
  }
  /* c8 ignore next */
  return rtf.format(Math.round(delta), 'year');
}

export function list(locale: string, items: readonly string[], type: Intl.ListFormatType = 'conjunction'): string {
  return new Intl.ListFormat(locale, { style: 'long', type }).format(items);
}

export function date(
  locale: string,
  d: Date | number,
  opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
): string {
  return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...opts }).format(d);
}
