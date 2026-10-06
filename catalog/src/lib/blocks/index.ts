// @core/blocks — bloques de página. Servidor y cliente: definición, registro y render. Editor del admin en `./editor.js`;
// resolución de imágenes en `./media.js` (consulta la base de datos). Estilos en `./blocks.css`.
export {
  type BlockContext,
  type BlockDefinition,
  type BlockInstance,
  BlockInstanceSchema,
  type BlockRegistry,
  blocksToText,
  collectMediaIds,
  createBlockRegistry,
  defineBlock,
  newBlockId,
} from './define.js';
export * from './core/index.js';
export { CtaLink, Heading, Img, JsonLd, Section } from './parts.js';
export { RenderBlocks, type RenderBlocksProps } from './render.js';
