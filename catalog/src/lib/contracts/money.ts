// Importe monetario: entero en unidades menores (céntimos) + código ISO 4217. Nunca `float`.
import { z } from 'zod';

export type Money = {
  /** Entero en unidades menores: 1999 = 19,99 EUR; 500 = 500 JPY. */
  amount: number;
  /** Código ISO 4217 en mayúsculas: `EUR`, `USD`, `JPY`. */
  currency: string;
};

export const MoneySchema = z.strictObject({
  amount: z.number().int().safe(),
  currency: z.string().regex(/^[A-Z]{3}$/),
});
