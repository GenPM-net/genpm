import '@/genpm';

export { sitemapIndexRoute as GET } from '@/lib/seo/adapters/next';
export const dynamic = 'force-dynamic'; // se genera en cada petición (con caché HTTP): el build no necesita BD ni SITE_URL
