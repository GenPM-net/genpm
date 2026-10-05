// Middleware de la web: idioma por prefijo de URL (reescritura interna, una sola copia de cada página), sesión,
// y cabeceras de seguridad (web-ui-spec §8: CSP estricta, HSTS, sin framing).

import { defineMiddleware } from 'astro:middleware';
import { env } from 'cloudflare:workers';
import { createT, PSEUDO } from '@genpm/i18n';
import { splitLocale } from './lib/i18n.js';
import { withRequest } from './lib/request-context.js';

const SESSION = '__Host-genpm_session';

export const onRequest = defineMiddleware((ctx, next) => withRequest(ctx.request, () => handle(ctx, next)));

const handle: Parameters<typeof defineMiddleware>[0] = async (ctx, next) => {
  const url = new URL(ctx.request.url);
  // Siempre HTTPS: la primera visita por http:// también (HSTS solo protege las siguientes). En local no aplica.
  if (url.protocol === 'http:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    url.protocol = 'https:';
    if (url.hostname.startsWith('www.')) url.hostname = url.hostname.slice(4);
    return Response.redirect(url.toString(), ctx.request.method === 'GET' || ctx.request.method === 'HEAD' ? 301 : 308);
  }
  // www.genpm.net → genpm.net (una sola URL canónica por página).
  if (url.hostname.startsWith('www.')) {
    return Response.redirect(`https://${url.hostname.slice(4)}${url.pathname}${url.search}`, 301);
  }
  // Agentes de IA que piden Markdown (`Accept: text/markdown` antes que HTML): la versión en texto de la misma página.
  const accept = ctx.request.headers.get('accept') ?? '';
  const wantsMd = accept.indexOf('text/markdown');
  const wantsHtml = accept.indexOf('text/html');
  if (ctx.request.method === 'GET' && wantsMd !== -1 && (wantsHtml === -1 || wantsMd < wantsHtml)) {
    const p = url.pathname.replace(/\/$/, '');
    const target = p === '' ? '/llms.txt' : /^\/(p\/@[^/]+\/[^/.]+|docs\/[a-z0-9-]+)$/.test(p) ? `${p}.md` : null;
    if (target) {
      const res = await ctx.rewrite(target);
      if (res.ok)
        return new Response(res.body, {
          headers: {
            'content-type': 'text/markdown; charset=utf-8',
            vary: 'Accept',
            'cache-control': 'public, max-age=300',
          },
        });
    }
  }
  // Tras `ctx.rewrite()` el middleware se vuelve a ejecutar con la ruta sin prefijo: se conserva el idioma ya resuelto.
  if (ctx.locals.t) return next();
  const { locale, path } = splitLocale(url.pathname);
  ctx.locals.locale = locale;
  ctx.locals.path = path;
  // `?pseudo=1` fuera de producción: pseudo-locale en-XA para detectar textos sin externalizar y desbordes (i18n §6).
  const pseudo = env.ENVIRONMENT !== 'production' && url.searchParams.get('pseudo') === '1';
  ctx.locals.t = await createT(pseudo ? PSEUDO : locale, ['web', 'common', 'errors']);
  const raw = ctx.cookies.get(SESSION)?.value;
  let session: App.Locals['session'] = null;
  if (raw) {
    try {
      session = JSON.parse(atob(raw)) as App.Locals['session'];
    } catch {
      session = null;
    }
  }
  ctx.locals.session = session;

  const res = locale !== 'en' && path !== url.pathname ? await ctx.rewrite(`${path}${url.search}`) : await next();
  res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // nosemgrep: javascript.express.security.x-frame-options-misconfiguration.x-frame-options-misconfiguration -- valor constante DENY, no viene del usuario
  res.headers.set('X-Frame-Options', 'DENY');
  if (env.ENVIRONMENT !== 'production') res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
  const html = (res.headers.get('content-type') ?? '').includes('text/html');
  if (!res.headers.has('Content-Language') && html) res.headers.set('Content-Language', locale);
  // Con sesión, el HTML lleva datos de la cuenta (menú, panel): nunca de una caché compartida ni sin revalidar.
  if (session && html) res.headers.set('Cache-Control', 'private, no-cache');
  return res;
};
