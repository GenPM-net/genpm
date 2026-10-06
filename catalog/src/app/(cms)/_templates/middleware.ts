// Copiar a src/middleware.ts (Next ≥ 15.5, runtime Node): redirecciones gestionadas en el panel antes de servir la página.
// Si el proyecto ya tiene middleware, añade la llamada a `redirectFor` al principio del suyo.
import { redirectFor } from '@/lib/site/adapters/next';

export async function middleware(req: Request) {
  return (await redirectFor(req)) ?? undefined;
}

export const config = { runtime: 'nodejs', matcher: ['/((?!_next|api|admin|favicon.ico|sitemap|robots.txt|llms.txt).*)'] };
