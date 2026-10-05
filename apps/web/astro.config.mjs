// genpm.net — Astro SSR + adapter Cloudflare + islas Preact + Tailwind v4 (tema generado desde docs/design/tokens.json).
import cloudflare from '@astrojs/cloudflare';
import preact from '@astrojs/preact';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://genpm.net',
  output: 'server',
  adapter: cloudflare({ imageService: 'passthrough' }),
  integrations: [preact()],
  trailingSlash: 'never',
  build: { format: 'file' },
  security: {
    checkOrigin: true,
    // CSP estricta (web-ui-spec §8): Astro añade los hashes de sus scripts y estilos; imágenes de terceros solo vía /img.
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        'frame-src https://challenges.cloudflare.com',
        "base-uri 'self'",
        "form-action 'self' https://github.com https://checkout.stripe.com https://billing.stripe.com",
        "object-src 'none'",
      ],
      scriptDirective: { resources: ["'self'", 'https://challenges.cloudflare.com'] },
      styleDirective: { resources: ["'self'", "'unsafe-inline'"] },
    },
  },
  vite: { plugins: [tailwindcss()] },
});
