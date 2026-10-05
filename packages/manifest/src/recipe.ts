// Recetas compose (V03-05): una lista con nombre de paquetes que se instalan juntos ("saas-starter = db + auth +
// billing"). Solo specs del registry (nunca `gh:` ni `file:`), sin duplicados. Puro: lo usan registry, CLI y MCP.

import { z } from 'zod';
import { parseSpec } from './spec.js';

export const RECIPE_SLUG_RE = /^[a-z0-9][a-z0-9-]{1,63}$/;
export const RECIPE_MAX_PACKAGES = 20;

export type Recipe = {
  /** Slug: `saas-starter`. */
  name: string;
  /** Resumen; string o mapa por idioma, como `s` del manifiesto. */
  s?: string | Record<string, string>;
  /** Specs del registry: `@core/auth` o `@core/auth@^1.2`. */
  p: string[];
};

const Summary = z.union([z.string().min(1).max(200), z.record(z.string().min(2).max(10), z.string().min(1).max(200))]);

export const RecipeSchema = z.strictObject({
  $schema: z.string().optional(),
  name: z.string().regex(RECIPE_SLUG_RE),
  s: Summary.optional(),
  p: z.array(z.string().min(3).max(140)).min(1).max(RECIPE_MAX_PACKAGES),
});

/** Valida una receta. Errores como `{ path, message }`, igual que el manifiesto. */
export function validateRecipe(
  input: unknown,
): { ok: true; data: Recipe } | { ok: false; issues: Array<{ path: string; message: string }> } {
  const r = RecipeSchema.safeParse(input);
  if (!r.success)
    return { ok: false, issues: r.error.issues.map((i) => ({ path: i.path.join('.') || '$', message: i.message })) };
  const issues: Array<{ path: string; message: string }> = [];
  const seen = new Set<string>();
  r.data.p.forEach((raw, idx) => {
    const p = parseSpec(raw);
    if (!p.ok || p.spec.kind !== 'registry') {
      issues.push({ path: `p.${idx}`, message: p.ok ? 'only registry packages (@scope/name)' : p.problem });
      return;
    }
    if (seen.has(p.spec.name)) issues.push({ path: `p.${idx}`, message: `duplicate ${p.spec.name}` });
    seen.add(p.spec.name);
  });
  if (issues.length) return { ok: false, issues };
  const { $schema: _s, ...data } = r.data;
  return { ok: true, data };
}
