# Campaña en redes: demos de GenPM (octubre 2026)

Material listo para publicar desde las cuentas del fundador. Todo es real: las demos funcionan, los repos son públicos y
la voz de los vídeos es la de Yoángel (clonada en local con Voicebox).

## Activos

| Pieza | Formato | Dónde |
|---|---|---|
| Vídeo restaurante (ES) | 9:16 y 16:9, 53 s, voz + subtítulos | `media/videos/genpm-restaurante-es-{v,h}.mp4` |
| Vídeo dropshipping (EN) | 9:16 y 16:9, voz + subtítulos | `media/videos/genpm-dropshipping-en-{v,h}.mp4` |
| Demo restaurante | Repo + guía online + PDF | [GenPM-net/demo-restaurante](https://github.com/GenPM-net/demo-restaurante) |
| Demo dropshipping | Repo + guía online + PDF | [GenPM-net/demo-dropshipping](https://github.com/GenPM-net/demo-dropshipping) |
| Plantilla SaaS | Repo plantilla | [GenPM-net/saas-starter](https://github.com/GenPM-net/saas-starter) |

Reglas de oro: una pieza por día y por canal, responder todos los comentarios las primeras 2 h, nunca comprar
seguidores ni pedir votos (HN y Reddit lo penalizan), y decir siempre que eres el creador.

## Calendario (2 semanas)

| Día | Canal | Pieza |
|---|---|---|
| Mar 1 | TikTok + Reels + Shorts | Restaurante (9:16, ES) |
| Mar 1 | LinkedIn (ES) | Post del restaurante + vídeo 16:9 |
| Mié 2 | X (EN) | Hilo de dropshipping + vídeo |
| Mié 2 | TikTok + Reels + Shorts | Dropshipping (9:16, EN) |
| Jue 3 | Hacker News | Show HN (15:00–17:00 CET, estar presente 6 h) |
| Vie 4 | Reddit r/nextjs | Plantilla saas-starter (post de proyecto) |
| Sáb 5 | Reddit r/webdev | *Showoff Saturday*: demo de dropshipping |
| Lun 8 | dev.to + Hashnode | Artículo: "Una tienda de dropshipping con un comando" (la guía) |
| Mar 9 | LinkedIn (EN) | Post dropshipping |
| Mié 10 | Comunidades ES | Discord de midudev (#proyectos), r/programacion |
| Jue 11 | Product Hunt | Lanzamiento (00:01 PT), con los dos vídeos |
| Vie 12 | Indie Hackers | Post "build in public": números reales de la semana |

## TikTok / Reels / Shorts

**Restaurante (ES)**
> Le hice la web a un restaurante con UN comando 🍷 Carta, reservas online y panel para que el dueño cambie precios sin
> llamarme. Todo es código abierto. Link en bio 👉 genpm.net
> #programacion #nextjs #webdev #restaurante #emprendimiento #ia

**Dropshipping (EN)**
> I built a full dropshipping store with ONE command 🛒 Supplier CSV in, prices from my margin, product landing page,
> Stripe checkout. 37 modules, all code I own. genpm.net
> #dropshipping #ecommerce #nextjs #webdev #shopify #ai

Primer comentario fijado en ambos: enlace al repo de la demo.

## X (EN), hilo

1. I built a complete dropshipping store with one command. Supplier catalog from a CSV, prices from my margin, product
   landing pages, Stripe checkout. 37 modules, and every line is code I own. 🧵 [vídeo 16:9]
2. `genpm add @core/kit-dropshipping` doesn't hide anything in node_modules: the code lands in src/, pinned to a commit
   SHA, verified with a signature. No install scripts, ever.
3. Each module ships an AGENTS.md. Claude Code or Cursor read it and wire everything up: env, migrations, routes, the
   layout. That's the part that usually takes a week.
4. The fun bits: a $8.40 lamp becomes €20.90 from one margin rule, delivery dates show before checkout, and the admin
   estimates real profit after supplier and Stripe fees.
5. Same thing for a restaurant site with bookings: `genpm add @core/kit-cms`. Both demos are open source:
   github.com/GenPM-net/demo-dropshipping · github.com/GenPM-net/demo-restaurante
6. GenPM is free and open source. I'd love feedback from people who build stores or client sites: genpm.net

## LinkedIn

**ES (restaurante)**
> Un restaurante necesita una web que pueda editar sin depender de nadie: carta, horarios, reservas.
>
> La he montado con un solo comando de GenPM, el gestor de paquetes que estoy construyendo: `genpm add @core/kit-cms`
> instala 19 módulos (panel, páginas por bloques, formularios, SEO, buscador) como código propio del proyecto, y cada
> uno trae instrucciones para que la IA lo integre.
>
> El resultado es Taberna Lumbre (restaurante ficticio): reservas online que llegan al panel y un dueño que cambia
> precios y fotos sin tocar código. Código y guía paso a paso: github.com/GenPM-net/demo-restaurante
>
> Si haces webs para negocios locales, me encantaría saber qué te falta. 👉 genpm.net

**EN (dropshipping)**
> Most store builders rent you a platform. GenPM gives you the code.
>
> `genpm add @core/kit-dropshipping` injects 37 modules into a Next.js project: catalog, cart, Stripe checkout, orders,
> shipping, reviews, suppliers via CSV, margin-based pricing, product landing pages and consent-gated pixels. Each one
> ships the rules your AI agent needs to integrate it.
>
> Demo store, code and a step-by-step guide: github.com/GenPM-net/demo-dropshipping. Feedback welcome. genpm.net

## Reddit

Leer las normas del subreddit el mismo día. Texto de valor, no anuncio; decir que eres el autor; responder todo.

**r/nextjs** — *I made a Next.js 16 SaaS starter where auth, Stripe and email are plain source you own*
> Hi! I'm the author of GenPM. The starter (github.com/GenPM-net/saas-starter) has GitHub login, Stripe subscriptions
> with an idempotent webhook, `hasEntitlement(user, 'pro')` gating and a welcome email — but instead of an auth library
> and a billing SDK, it's ~1,100 lines of TypeScript in src/lib that you can read and change, installed with
> `genpm add @core/billing @core/email`. Happy to answer questions about the design (cookie sessions, webhook dedupe,
> Drizzle schemas per module).

**r/webdev (Showoff Saturday)** — *A dropshipping store from one command, all source code you own*
> [vídeo] Demo + code: github.com/GenPM-net/demo-dropshipping. What I'd love feedback on: does "the module ships an
> AGENTS.md so your AI agent integrates it" match how you actually work with Cursor/Claude?

## Hacker News

Usar `docs/launch/show-hn.md` (ya actualizado), añadiendo al primer comentario:
> Two end-to-end demos built only with `genpm add` + the agent rules: a restaurant site with bookings
> (github.com/GenPM-net/demo-restaurante) and a dropshipping store (github.com/GenPM-net/demo-dropshipping).

## dev.to / Hashnode

Publicar `demo-dropshipping/docs/MANUAL.md` como artículo con el título *"Launch a dropshipping store with one
command (and own every line of code)"*, con `canonical_url` apuntando al repo. En español, la guía del restaurante.

## Product Hunt

- **Nombre:** GenPM · **Tagline:** Install whole features as code you own, with rules for your AI
- **Descripción:** GenPM injects complete modules (auth, Stripe billing, store, CMS, dropshipping…) into your project as
  source code, pinned to a verified commit, with the AGENTS.md rules your AI agent needs to integrate them. Free and
  open source.
- **Galería:** los dos vídeos 16:9 + capturas de `docs/screens` de cada demo.
- **Primer comentario del maker:** la historia en 4 líneas y las dos demos.

## Medir

- Instalaciones reales: Analytics Engine `genpm_installs` (sin las internas). Visitas reales: `genpm_web_events` con
  `blob5 = 'human'` y referente no vacío.
- Estrellas y visitas de los repos de demo: `gh api repos/GenPM-net/<repo>/traffic/views`.
- Revisar cada lunes qué canal trajo instalaciones y repetir lo que funcione.
