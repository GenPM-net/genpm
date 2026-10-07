// Proyecto de ejemplo del workspace: comprueba que los paquetes y kits compilan en una app Next real
// (con webpack y con Turbopack: los paquetes importan con extensión `.ts`, ADR-034).
import type { NextConfig } from 'next';

const config: NextConfig = {
  typescript: { tsconfigPath: 'tsconfig.app.json' },
  // Como recomienda kit-cms: título, descripción y canonical en <head> para todos (Next 15 los transmite al <body>).
  htmlLimitedBots: /.*/,
};

export default config;
