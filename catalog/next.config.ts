// Proyecto de ejemplo del workspace: comprueba que los paquetes y kits compilan en una app Next real.
import type { NextConfig } from 'next';

const config: NextConfig = {
  // Los paquetes importan con extensión `.js` (ESM de Node); en Next resuelven al `.ts` correspondiente.
  webpack(cfg) {
    cfg.resolve.extensionAlias = { '.js': ['.ts', '.tsx', '.js'] };
    return cfg;
  },
  typescript: { tsconfigPath: 'tsconfig.app.json' },
};

export default config;
