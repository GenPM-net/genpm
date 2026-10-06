// Qué se indexa en la búsqueda del sitio.
import { blogSearchSource } from '@/lib/blog';
import { blocksToText } from '@/lib/blocks';
import { contentSearchSource } from '@/lib/content';
import type { BlockInstance } from '@/lib/blocks';
import { toPlainText } from '@/lib/rich-text';
import { registerSearchSource } from '@/lib/search';
import { blocks } from './blocks';
import { pagePath } from './content';

registerSearchSource(
  contentSearchSource('pages', {
    path: pagePath,
    text: (d) => blocksToText(d.blocks as BlockInstance[], blocks, (doc) => toPlainText(doc as never)),
  }),
);
registerSearchSource(blogSearchSource()); // kit-blog
