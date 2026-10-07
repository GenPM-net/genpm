// Páginas creadas desde el panel. Las rutas propias del proyecto tienen prioridad (Next resuelve antes las estáticas).
import type { Metadata } from 'next';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { resolveRedirect } from '@/lib/site';
import { CmsPage, pageMetadata, type SearchParams } from '../_lib/page';

type Props = { params: Promise<{ slug: string[] }>; searchParams: Promise<SearchParams> };

const slugOf = (parts: string[]) => (parts.length === 1 && parts[0] !== 'home' ? parts[0]! : null);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = slugOf((await params).slug);
  return slug ? pageMetadata(slug) : {};
}

export default async function Page({ params, searchParams }: Props) {
  const parts = (await params).slug;
  const slug = slugOf(parts);
  const page = slug ? await CmsPage({ slug, searchParams: await searchParams }) : null;
  if (page) return page;
  // Antes del 404: redirecciones gestionadas en el panel (si no hay middleware de @core/site).
  const path = `/${parts.map(encodeURIComponent).join('/')}`;
  const r = await resolveRedirect(path).catch(() => null);
  if (r) (r.status === 301 || r.status === 308 ? permanentRedirect : redirect)(r.to);
  notFound();
}
