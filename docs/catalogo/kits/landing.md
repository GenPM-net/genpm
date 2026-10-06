# `@core/kit-landing` — landings que convierten

> Parte del [catálogo](../README.md) · Fase F3 · Estado: planificación.
> Prompt de aceptación: *"Crea una landing para captar leads de mi producto con genpm"*.

## 1. Qué obtiene el usuario

Landings creadas desde el admin combinando bloques (hero, beneficios, testimonios, FAQ, garantía, CTA, formulario…),
cada una con su URL, SEO propio y opción de ocultar cabecera/pie para no distraer; captación de leads con formulario o
suscripción; banner de cookies; píxeles de Meta/TikTok/GA4 que solo se cargan con consentimiento; y, desde la 1.1,
tests A/B entre variantes.

## 2. Manifiesto

| Campo | Valor |
|---|---|
| `d` | `src/app/(landing)` |
| `g` | `@core/kit-cms`, `@core/consent`, `@core/pixels` (+ `@core/experiments` en 1.1) |
| `p` | — |
| `e` | Las de `pixels` (todas opcionales) |
| `m` | — |

Reutiliza sin repetir: `blocks`, `forms`, `newsletter` si está instalado, `seo`, `media`, `admin`.

## 3. Qué contiene

| Pieza | Detalle |
|---|---|
| Colección `landings` | Bloques, SEO, layout (`full` \| `minimal` sin navegación), objetivo de conversión (`lead`, `purchase`, `click`), página de gracias |
| Ruta `/lp/[slug]` | Render de la landing (prefijo configurable; puede servirse en `/` como home) |
| Ruta `/lp/[slug]/thanks` | Gracias + evento de conversión (servidor y navegador con el mismo `eventId`) |
| Bloques extra | "Formulario de lead" (de `forms`), "Contador real" (fecha fin verdadera, ver reglas), "Prueba social" (datos reales de `reviews`/`newsletter` si existen) |
| Consentimiento | `<ConsentBanner>` montado en el layout raíz; enlace "preferencias de cookies" en el pie |
| UTM | Captura de UTM y click IDs en primera parte, adjuntos al envío del formulario |
| Admin | Recurso `landings` con vista previa por dispositivo; widget "leads por landing (7 días)" |

## 4. Reglas del `AGENTS.md` (anti dark patterns)

- **Nada de urgencia falsa:** contadores solo con fecha de fin real que se respeta; stock "quedan X" solo si es dato real.
  (Prácticas engañosas prohibidas por la Directiva 2005/29/CE y la DSA.)
- Testimonios y cifras solo con datos reales proporcionados por el usuario; si faltan, dejar el bloque vacío y avisar.
- Ningún píxel fuera de `ConsentGate`; nunca casillas de consentimiento premarcadas.
- Rendimiento: LCP < 2,5 s en móvil; imágenes del hero con `priority` y tamaño correcto.

## 5. Integración

1. Requiere `kit-cms`.
2. Montar `ConsentBanner` en el layout raíz (el agente edita el layout del usuario: es una línea, documentada).
3. Configurar las variables de las plataformas que se usen (ninguna es obligatoria).
4. Verificar: crear landing, enviar lead, ver evento en el modo de prueba de cada plataforma.

## 6. Aceptación específica

- Sin consentimiento: 0 peticiones a dominios de terceros (Playwright con interceptación).
- Lead ⇒ envío guardado con UTM, email al equipo y evento `lead` deduplicado.
- Lighthouse ≥ 95 en móvil en la landing de ejemplo.
