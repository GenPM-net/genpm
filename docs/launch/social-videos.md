# Vídeos cortos para redes — reglas de producción

Reglas para generar la serie de vídeos cortos (Reels, TikTok, Shorts) que muestran GenPM usado en un proyecto real.
El plan de la serie y su estado viven en el documento "GenPM — Plan de videos para redes"; este archivo fija **cómo**
se hace cada vídeo para que todos salgan iguales, los haga quien los haga (persona o agente).

## 1. Veracidad (no negociable)

- **Todo lo que sale en pantalla viene de una ejecución real** del CLI de este repo sobre un proyecto de prueba:
  nombres, versiones, SHAs, rutas, archivos y mensajes. Nada de salidas inventadas ni maquetas.
- Los paquetes se descargan de sus repos reales (`github.com/genpm-net/*`) en su último tag; el SHA mostrado es el
  del commit instalado.
- Retoques permitidos, siempre sin cambiar el significado:
  - partir líneas largas para que quepan a ~55 columnas;
  - recortar un archivo a sus campos o líneas relevantes, marcando el recorte con `…`;
  - pretty-print de JSON (mostrar el comando que lo haría, p. ej. `jq .p genpm.lock`);
  - reconstruir la salida de una herramienta que no esté instalada (p. ej. `tree`) a partir del listado real de archivos.
- **Nunca** mostrar: la URL del registry local, claves o firmas de desarrollo (`sg: "dev1:…"`), tokens, rutas del
  contenedor (`/tmp/…`, `/home/…`) ni datos personales.
- Los mensajes de seguridad siguen [branding §8](../branding.md#8-identidad-visual) y [security §0](../security.md#0-sobre-100--de-seguridad):
  "Seguro por diseño, verificable por cualquiera"; nunca "100 % seguro".

## 2. Formato

| Parámetro | Valor |
|---|---|
| Resolución | 1080×1920 (9:16). 1:1 o 16:9 solo bajo pedido, como versión aparte |
| Duración | 20–45 s (objetivo ~30 s) |
| Vídeo | MP4 H.264, `yuv420p`, 30 fps, CRF 18, `-movflags +faststart` |
| Audio | AAC 192 kbps, 48 kHz estéreo, −16 LUFS integrados, pico ≤ −1.5 dBTP |
| Nombre | `genpm-<dev\|vibe>-<es\|en>.mp4` por vídeo (+ `-v<k>` por revisión); ver §5 bis |

**Zonas seguras:** nada importante en los 150 px de arriba ni en los ~400 px de abajo (los tapa la interfaz de la red
social). Logo arriba a 150 px, terminal entre 270 y 1280 px, subtítulo desde 1310 px.

## 3. Identidad visual

- **Superficie oscura de marca** (el oscuro está permitido en terminal: branding §8). Colores de `docs/design/tokens.json` → `color.dark`:
  fondo `#0B0D11`, superficie `#14171C`, línea `#2A2E36`, texto `#EDEEF0` / `#A3A9B6` / `#8C93A0`.
- **El color es dato:** verde `code` `#C4F54A` solo para la capa Code, el prompt y el éxito (`✔`, `scan passed`);
  violeta `context` `#8B7CFF` para reglas IA y SHAs; cian `mcp` `#38D5E8` para MCP; ámbar `#F5B83D` para variables
  de entorno y avisos. Nada de degradados ni sombras: bordes de 1 px.
- **Tipografía:** Instrument Sans Bold para titulares y subtítulos (tracking −2 % a −3.5 %); JetBrains Mono para la
  terminal (29 px, interlineado 1.5, sin ligaduras) y para las líneas secundarias del subtítulo.
- **Logo:** `docs/design/brand/wordmark-inverse.svg`, sin modificar.
- **Prompt:** `❯ ` en verde; el caret `▍` en verde es lo único que parpadea (2 Hz). Tecleo a 22 caracteres/s; la
  salida aparece línea a línea (0.08–0.17 s por línea).

## 4. Estructura de cada vídeo

1. **Gancho (0–4 s):** una pregunta o afirmación de una frase, titular grande (92 px), una palabra clave en verde.
2. **Escenas de terminal (3–5):** un comando por escena. Cada escena lleva un subtítulo de dos niveles: frase corta en
   Instrument Sans (56 px) + aclaración en mono (30 px). Un cuadrado de color antes del subtítulo cuando la escena
   habla de una capa (Code, Context, MCP).
3. **Cierre (3–4 s):** logo, "Instala arquitecturas, no dependencias.", las tres C con su color y `genpm.net`.

Transiciones: fundido de 0.35 s entre gancho, terminal y cierre; dentro de la terminal, el contenido sale y entra con
un fundido de 0.22 s y un desplazamiento de 14 px. Sin cortes secos.

## 5. Voz en off

- **Motor:** Kokoro v1.0 (modelo abierto, local) vía `kokoro-onnx`; modelo y voces de las releases de
  `thewh1teagle/kokoro-onnx` (`model-files-v1.0`). Voz `em_alex` (alternativa: `ef_dora`), velocidad 1.05.
- **Español latino:** fonemizar con `lang="es-419"` (seseo). Nunca `es` (español peninsular, pronuncia `θ`).
- **Texto → fonemas** con `is_phonemes=True`, sustituyendo estos términos por su pronunciación fija:

  | Término | Fonemas | Suena |
  |---|---|---|
  | GenPM | `dʒˈɛn pˈiː ˈɛm` | "yen pi em", en inglés |
  | commit | `kˈomit` | "cómit" |
  | node_modules | `nˈowd mˈoðjuls` | "noud módiuls" |
  | IA | `ˌi ˈa` | "i a" |
  | Cursor | `kˈeɾsoɾ` | "kérsor" |
  | Claude Code | `klˈod kˈowd` | "clod coud" |

  Cualquier término técnico nuevo en inglés se añade a esta tabla antes de generar.
- **Toma continua:** frases generadas una a una y unidas con pausas de 0.32 s (misma escena) y 0.5 s (cambio de
  escena); 0.25 s de silencio al inicio y 0.9 s al final. Ninguna pausa supera 0.6 s.
- **El vídeo sigue a la voz, no al revés:** cada escena empieza 0.25 s antes de su primera frase y termina cuando
  empieza la siguiente; la duración total la marca la narración.
- **Tratamiento:** `highpass=f=70, lowpass=f=13000, acompressor=threshold=-20dB:ratio=2.5:attack=5:release=90,
  aecho=0.8:0.6:24:0.10, loudnorm=I=-16:TP=-1.5:LRA=11`.
- **Guion:** frases cortas y habladas ("Mira:", "Además,"), tuteo, ~2.5 palabras/s. La voz no repite el subtítulo
  palabra por palabra: lo complementa.
- Comprobar siempre los fonemas generados antes de renderizar; una herramienta automática no escucha el audio, así que
  la persona que publica lo revisa antes de subirlo.

## 5 bis. Audiencias e idiomas

Cada vídeo sale en **cuatro versiones**: dos audiencias × español e inglés (`genpm-<dev|vibe>-<es|en>.mp4`).

| | Programadores (`dev`) | Vibecoders (`vibe`) |
|---|---|---|
| Quién | Saben qué es npm, un lockfile o un SHA | Usan IA para crear apps, nunca programaron |
| Imagen | Terminal real (§1, §3, §4) | Dibujo a mano estilo cuaderno: sin terminal, sin código, sin jerga |
| Metáforas | Ninguna: el comando y su salida | Robot = la IA · bloque de construcción = paquete · carpeta = tu proyecto · manual = `AGENTS.md` · sello "revisado" = commit fijado |
| Texto | Titular + aclaración técnica en mono | Una sola frase corta (≤ 8 palabras) con una palabra clave subrayada en verde |
| Voz | `em_alex` (es-419) / `am_michael` (en-us), velocidad 1.05 | Las mismas voces a velocidad 1.0, frases más cortas |

Reglas del estilo `vibe`:
- Fondo blanco con cuadrícula de cuaderno (60 px, `#EEF0F3`); trazo de tinta de 6 px dibujado con rough.js; rellenos
  con rayado de cera en los colores de las tres C, ámbar y rojo. El dibujo "hierve" a 4 fps (semilla de rough.js
  cambiando cada 0.25 s), como animación a mano.
- Tipografía Outfit Bold (titular 84 px) y NothingYouCouldDo solo para notas manuscritas cortas ("¡Listo!", "tu proyecto").
- Cada escena explica **una sola idea** con un dibujo; todo lo que se dice tiene que ser cierto del producto
  (p. ej. las piezas "login, pagos, emails" son `@core/auth`, `@core/billing` y `@core/email`).
- Sin palabras técnicas en pantalla ni en la voz (nada de "commit", "dependencia", "MCP", "lockfile").
- Cierre: wordmark de tinta (`wordmark.svg`), "Piezas listas para tu IA" / "Ready-made pieces for your AI" y `genpm.net`.

Inglés: fonemizar con `lang="en-us"`; GenPM mantiene `dʒˈɛn pˈiː ˈɛm` y `node_modules` → `nˈoʊd mˈɑːdʒuːlz`.
Los textos en pantalla se traducen, no se resumen; la salida del CLI queda igual en ambos idiomas.

## 6. Entorno de grabación

1. `pnpm install && pnpm --filter @genpm-net/cli... build`.
2. Registry local: `cp apps/registry/.dev.vars.example apps/registry/.dev.vars`, `pnpm --filter @genpm/registry migrate:local`
   y cargar un seed con los **manifiestos reales**: clonar `genpm-net/{db,auth,billing,email,ai}` en su último tag,
   completar `r`, `t`, `c` (SHA real), `i` y `x`, y firmarlos con `buildSeed()` de `apps/registry/scripts/seed-lib.mjs`
   y la clave `dev1` (el CLI solo la acepta contra registries locales). No usar `seeds/fixtures.sql`: sus SHAs son ficticios.
3. `wrangler dev --port 8787 --local-upstream localhost:8787` (sin `--local-upstream` el Worker redirige a https).
   Tras recargar datos, borrar `.wrangler/state/v3/cache` y reiniciar: el registry cachea las respuestas.
4. Proyecto de prueba `demo-app`: carpeta vacía con `git init` y un `package.json` mínimo; uno nuevo por vídeo.
5. Ejecutar con `GENPM_TELEMETRY=0 GENPM_REGISTRY=http://localhost:8787` y guardar la salida real.

## 7. Render

- La escena es una página HTML de 1080×1920 con una función `render(t)` determinista (sin animaciones CSS ni timers).
- Playwright (Chromium) llama a `render(i / 30)` en cada fotograma, hace captura PNG y la envía por tubería a ffmpeg
  (`-f image2pipe -c:v png`). Así no se pierden fotogramas y el resultado es idéntico en cada render.
- Antes del render completo, revisar una hoja de contactos con 6 fotogramas clave (gancho, cada escena, cierre) y los
  fotogramas de transición.

## 8. Entrega

Por cada vídeo: MP4 mudo, MP4 con voz, portada PNG (último fotograma del cierre) y un `.md` con el guion por tiempos,
el texto de la publicación con hashtags y la música sugerida. La música no se añade (sin licencia): la pone quien
publica. Actualizar el estado en el documento del plan; marcar el vídeo como hecho solo al publicarlo.

## Checklist antes de entregar

- [ ] Toda la salida viene de una ejecución real; los retoques son solo los de §1.
- [ ] No aparecen la URL local, claves `dev1`, tokens ni rutas del contenedor.
- [ ] Textos dentro de las zonas seguras; legibles en un móvil a tamaño real.
- [ ] GenPM suena "yen pi em"; fonemas revisados con `es-419`.
- [ ] Ninguna pausa de voz supera 0.6 s; las escenas cambian con la voz.
- [ ] −16 LUFS, 30 fps, 1080×1920, H.264 `yuv420p`.
