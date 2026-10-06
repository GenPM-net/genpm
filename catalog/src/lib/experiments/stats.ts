// Estadística de los resultados: test z de dos proporciones (bilateral) e intervalo de confianza de la diferencia.
// Sin dependencias; validado con ejemplos de referencia en los tests.

/** Función de distribución normal estándar (Abramowitz–Stegun 7.1.26, error < 1,5e-7). */
export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.3275911 * (Math.abs(z) / Math.SQRT2));
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

export type Comparison = {
  /** Tasa de conversión de control y variante (0–1). */
  controlRate: number;
  variantRate: number;
  /** Mejora relativa sobre el control (0,25 = +25 %); null si el control no tiene conversiones. */
  lift: number | null;
  z: number;
  pValue: number;
  /** Intervalo de confianza del 95 % de la diferencia absoluta de tasas. */
  ci95: [number, number];
  /** p < 0,05 y muestra mínima (≥ 100 participantes y ≥ 10 conversiones por grupo). */
  significant: boolean;
};

export function compare(control: { n: number; conversions: number }, variant: { n: number; conversions: number }): Comparison {
  const p1 = control.n ? control.conversions / control.n : 0;
  const p2 = variant.n ? variant.conversions / variant.n : 0;
  const pooled = control.n + variant.n ? (control.conversions + variant.conversions) / (control.n + variant.n) : 0;
  const se = control.n && variant.n ? Math.sqrt(pooled * (1 - pooled) * (1 / control.n + 1 / variant.n)) : 0;
  const z = se ? (p2 - p1) / se : 0;
  const pValue = se ? 2 * (1 - normalCdf(Math.abs(z))) : 1;
  const seDiff = control.n && variant.n ? Math.sqrt((p1 * (1 - p1)) / control.n + (p2 * (1 - p2)) / variant.n) : 0;
  const enough = Math.min(control.n, variant.n) >= 100 && Math.min(control.conversions, variant.conversions) >= 10;
  return {
    controlRate: p1,
    variantRate: p2,
    lift: p1 ? (p2 - p1) / p1 : null,
    z,
    pValue,
    ci95: [p2 - p1 - 1.959964 * seDiff, p2 - p1 + 1.959964 * seDiff],
    significant: enough && pValue < 0.05,
  };
}
