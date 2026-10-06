// Bloques disponibles en las páginas. Los kits y el proyecto añaden los suyos a la lista.
import { latestPosts } from '@/app/(blog)/_blocks/latest-posts'; // kit-blog
import { coreBlocks, createBlockRegistry } from '@/lib/blocks';

export const blocks = createBlockRegistry([...coreBlocks, latestPosts]);
