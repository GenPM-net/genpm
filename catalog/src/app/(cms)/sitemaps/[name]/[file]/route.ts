import '@/genpm';

export { sitemapChunkRoute as GET } from '@/lib/seo/adapters/next';
export const revalidate = 3600;
export const dynamic = 'force-dynamic'; // se genera en cada petición (con caché HTTP): el build no necesita BD ni SITE_URL
