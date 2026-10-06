// @core/blocks — bloques de página. Servidor y cliente: definición, registro y render. Editor del admin en `./editor.js`;
// resolución de imágenes en `./media.js` (consulta la base de datos). Estilos en `./blocks.css`.
export {
  type BlockContext,
  type BlockDefinition,
  type BlockInstance,
  type BlockMeta,
  blockMeta,
  BlockInstanceSchema,
  type BlockRegistry,
  blocksToText,
  collectMediaIds,
  createBlockRegistry,
  defineBlock,
  newBlockId,
} from './define.ts';
export * from './core/index.ts';
export { CtaLink, Heading, Img, JsonLd, Section } from './parts.ts';
export { RenderBlocks, type RenderBlocksProps } from './render.ts';
