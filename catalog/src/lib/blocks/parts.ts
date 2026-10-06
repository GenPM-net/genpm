// Piezas comunes de los bloques: encabezados con nivel, imágenes resueltas, enlaces seguros y JSON-LD.
import { createElement as h, type ReactNode } from 'react';
import { z } from 'zod';
import { isSafeHref, type ResolvedImage } from '../rich-text/index.ts';
import type { BlockContext } from './define.ts';

type Level = BlockContext['level'];
const clamp = (n: number) => Math.min(Math.max(n, 1), 6) as Level;

export function Heading(p: { level: number; children?: ReactNode; className?: string; id?: string }): ReactNode {
  return h(`h${clamp(p.level)}`, { className: p.className, id: p.id }, p.children);
}

export function Img(p: { image: ResolvedImage | null; className?: string; priority?: boolean; alt?: string }): ReactNode {
  if (!p.image) return null;
  const { src, alt, width, height, srcSet, sizes } = p.image;
  return h('img', { src, alt: p.alt ?? alt, width, height, srcSet, sizes, className: p.className, loading: p.priority ? 'eager' : 'lazy', decoding: 'async', ...(p.priority && { fetchPriority: 'high' }) });
}

/** Enlace de llamada a la acción: solo rutas relativas, http(s), mailto y tel. */
export function CtaLink(p: { href?: string | null; label?: string | null; variant?: 'primary' | 'default'; siteHost?: string | undefined }): ReactNode {
  if (!p.href || !p.label || !isSafeHref(p.href)) return null;
  const external = /^https?:\/\//i.test(p.href) && (() => {
    try {
      return new URL(p.href).host !== p.siteHost;
    } catch {
      return true;
    }
  })();
  return h('a', { href: p.href, className: `ui-button${p.variant === 'primary' ? ' ui-button--primary' : ''}`, ...(external && { rel: 'noopener noreferrer' }) }, p.label);
}

/** `<script type="application/ld+json">` sin posibilidad de cerrar la etiqueta desde los datos. */
export function JsonLd(p: { data: unknown }): ReactNode {
  const json = JSON.stringify(p.data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return h('script', { type: 'application/ld+json', dangerouslySetInnerHTML: { __html: json } });
}

/** Sección estándar: `<section aria-labelledby>` con encabezado opcional e introducción. */
export function Section(p: { id: string; block: string; title?: string | undefined; intro?: string | undefined; ctx: BlockContext; children?: ReactNode; className?: string; label?: string }): ReactNode {
  const hid = `${p.id}-title`;
  return h(
    'section',
    { className: `blk blk-${p.block}${p.className ? ` ${p.className}` : ''}`, ...(p.title ? { 'aria-labelledby': hid } : p.label ? { 'aria-label': p.label } : {}) },
    p.title && h(Heading, { level: p.ctx.level, id: hid, className: 'blk__title' }, p.title),
    p.intro && h('p', { className: 'blk__intro' }, p.intro),
    p.children,
  );
}

// Esquemas reutilizables.
export const text = (max = 200) => z.string().trim().min(1).max(max);
export const optText = (max = 200) => z.string().trim().max(max).optional().transform((v) => v || undefined);
export const href = z
  .string()
  .trim()
  .max(500)
  .refine((v) => !v || isSafeHref(v), 'Unsafe link')
  .optional()
  .transform((v) => v || undefined);
export const mediaId = z.string().max(40).optional().nullable().transform((v) => v || undefined);
