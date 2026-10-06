// `<Experiment>`: elige el contenido de la variante del visitante (Server Component).
import type { ReactNode } from 'react';
import { getVariant } from './experiments.js';

/** `<Experiment name="hero-test" cookieHeader={…} variants={{ a: <HeroA />, b: <HeroB /> }} />` (el control si falta). */
export async function Experiment(p: { name: string; cookieHeader: string | null | undefined; variants: Record<string, ReactNode> }): Promise<ReactNode> {
  const { variant } = await getVariant(p.name, p.cookieHeader);
  const keys = Object.keys(p.variants);
  return p.variants[variant] ?? (keys.length ? p.variants[keys[0]!] : null);
}
