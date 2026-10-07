// Bloques disponibles en las páginas. Los kits y el proyecto añaden los suyos a la lista.
import { latestPosts } from '@/app/(blog)/_blocks/latest-posts'; // kit-blog
import { countdown } from '@/app/(landing)/_blocks/countdown'; // kit-landing
import { buyNow, productGrid } from '@/app/(store)/_blocks/products'; // kit-store
import { coreBlocks, createBlockRegistry } from '@/lib/blocks';

export const blocks = createBlockRegistry([
  ...coreBlocks,
  latestPosts, // kit-blog
  countdown, // kit-landing
  productGrid, // kit-store
  buyNow, // kit-store
]);
