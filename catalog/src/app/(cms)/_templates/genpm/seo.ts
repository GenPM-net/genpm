// Fuentes del sitemap y contenido de llms.txt.
import { contentSitemapSource } from '@/lib/content';
import { registerSitemapSource } from '@/lib/seo';
import { pagePath } from './content';

registerSitemapSource(contentSitemapSource('pages', pagePath));
