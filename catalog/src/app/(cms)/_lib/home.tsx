// Portada gestionada desde el panel (página con slug `home`). En el proyecto: `src/app/page.tsx` →
//   export { default, generateMetadata } from './(cms)/_lib/home';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CmsPage, pageMetadata, type SearchParams } from './page';

export const generateMetadata = (): Promise<Metadata> => pageMetadata('home');

export default async function Home({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (await CmsPage({ slug: 'home', searchParams: await searchParams })) ?? notFound();
}
