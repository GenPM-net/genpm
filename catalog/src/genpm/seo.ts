// Fuentes del sitemap y contenido de llms.txt.
import { blogSitemapSource } from '@/lib/blog';
import { productSitemapSource } from '@/lib/catalog';
import { contentSitemapSource } from '@/lib/content';
import { registerSitemapSource } from '@/lib/seo';
import { landingPath } from '@/app/(landing)/_lib/landings'; // kit-landing
import { pagePath } from './content';

registerSitemapSource(contentSitemapSource('pages', pagePath));
registerSitemapSource(blogSitemapSource()); // kit-blog
registerSitemapSource(contentSitemapSource('landings', landingPath)); // kit-landing
registerSitemapSource(productSitemapSource()); // kit-store
