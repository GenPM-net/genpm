# GenPM — Guía de marca

> Estado: **v0.2** · Fecha: 2026-10-02 · Alcance: nombre, posicionamiento, mensajes, voz, identidad visual, CLI y lanzamiento.
> v0.2: identidad visual "Anclado" (light-first, sin sombras, color solo con significado). Referencia visual: [design/genpm-identidad.html](design/genpm-identidad.html) · tokens: [design/tokens.json](design/tokens.json).
> Pendiente legal: búsqueda de marca registrada "GenPM" (USPTO, EUIPO, INPI Brasil, SAPI Venezuela, IMPI México) antes de invertir en la marca.
> Idiomas: la marca vive en 8 idiomas ([i18n](i18n.md)); el nombre **genpm** nunca se traduce ni se adapta.

---

## 1. Esencia

| | |
|---|---|
| **Misión** | Que cualquier persona construyendo con IA pueda incorporar arquitecturas probadas en minutos, entendiéndolas y siendo dueña de ellas. |
| **Visión** | El estándar abierto con el que el software se comparte en la era de los agentes: código + contexto + conexiones. |
| **Propósito** | Acabar con las cajas negras. Si tu IA no puede leerlo, no debería estar en tu proyecto. |
| **Personalidad** | Precisa, directa, generosa, con un punto de irreverencia de terminal. Un senior que te ayuda sin hacerte sentir junior. |

## 2. Nombre

- **GenPM** = *Generative Package Manager*. "Gen" también evoca *genes*: módulos que se injertan en tu proyecto y pasan a ser parte de su ADN.
- Pronunciación: "yen-pi-em" (ES) / "jen-pee-em" (EN).
- Escritura:
  | Contexto | Forma | Ejemplo |
  |---|---|---|
  | Prosa, títulos | **GenPM** | "GenPM inyecta arquitecturas completas." |
  | Comando, paquete npm, URLs | **`genpm`** | `npx genpm add @core/auth` |
  | Incorrecto | ~~GENPM~~, ~~Genpm~~, ~~GenPm~~, ~~Gen PM~~, ~~gen-pm~~ | — |
- **"genpm en todo"** (ADR-015): un solo nombre en todos los canales.
  | Canal | Handle |
  |---|---|
  | Web | **genpm.net** (+ `genpm.dev` → redirección) |
  | npm | `genpm` (CLI) y org `@genpm` |
  | GitHub | `GenPM-net` (✅ creada; `genpm` está ocupado por una cuenta inactiva) |
  | X / Discord / YouTube / LinkedIn | `@genpm` (fallback `genpmnet` / `genpm-net`) |
  | Email | **`hello@genpm.net`** (único por ahora; seguridad con asunto `[SECURITY]`, patrocinios con `[SPONSORS]`) |
- A los paquetes se les llama **packages** (en ES: "paquetes"). Evitar metáforas propias ("genes", "blueprints") en superficies técnicas: suman fricción. La metáfora del injerto vive solo en la narrativa y el visual.

## 3. Posicionamiento

**Declaración:**
> Para desarrolladores que construyen con agentes de IA, **GenPM** es el gestor de paquetes que inyecta arquitecturas completas
> — código fuente, reglas de IA y servidores MCP — directamente en tu proyecto. A diferencia de npm, que esconde dependencias en
> `node_modules`, GenPM te da código que es tuyo y contexto que tu IA entiende, anclado a commits inmutables.

**Categoría:** *Generative Package Manager*. No competimos con npm (lo complementamos: GenPM propone tus deps npm); competimos con
"copiar y pegar de un repo" y con los generadores de plantillas que no se actualizan.

**Contra quién nos comparamos (mensaje, no ataque):**
| Frente a… | Decimos |
|---|---|
| npm / node_modules | "Dependencias que tu IA puede leer y cambiar." |
| Plantillas / boilerplates | "Plantillas con versión, procedencia y actualizaciones." |
| shadcn/ui | Respeto explícito: "La filosofía de shadcn, para arquitecturas completas y con MCP." |
| Reglas sueltas (.cursorrules) | "Reglas que viajan con el código que describen." |

## 4. Audiencias

| Persona | Quién | Dolor | Mensaje que resuena |
|---|---|---|---|
| **Vibe coder / indie hacker** | Construye SaaS con Cursor/Claude Code, poco tiempo | La IA reinventa auth y billing en cada proyecto, con bugs | "Auth, pagos y emails en un prompt. Bien hechos." |
| **Dev senior con agentes** | Usa IA a diario, exigente con la calidad | Código generado inconsistente; dependencias opacas | "Código auditable, SHA inmutable, reglas con alcance. Cero scripts." |
| **Autor de paquetes / DevRel** | Empresas de dev tools (pagos, email, auth) | Su SDK se integra mal cuando lo hace una IA | "Publica la integración correcta con las reglas para que la IA no se equivoque." (→ patrocinios) |
| **Platform team (B2B)** | Equipos de plataforma en empresas | Cada equipo integra lo mismo distinto | "Tu catálogo interno de arquitecturas aprobadas, privado." (→ registros privados) |

## 5. Pilares de mensaje — las tres C

Un paquete GenPM tiene tres capas; cada una tiene **su color** en todo el sistema visual (ver §8.2).

| Pilar | Promesa | Prueba |
|---|---|---|
| **Code** — *Código que es tuyo* | Se inyecta en `src/`, no en una caja negra | Lo ves en tu diff, lo editas, lo commiteas |
| **Context** — *Contexto que tu IA entiende* | Reglas que se cargan solo donde importan | `AGENTS.md` por módulo, reglas con glob por IDE |
| **Connections** — *Conexiones listas* | Los MCP que el módulo necesita, declarados | `m` en el manifiesto, con tu consentimiento |
| **+ Inmutable por diseño** (pilar transversal) | Lo que revisaste es lo que se instala | SHA verificado, cero scripts |

## 6. Taglines

| Uso | EN (principal) | ES |
|---|---|---|
| **Principal** | **Install architectures, not dependencies.** | **Instala arquitecturas, no dependencias.** |
| Pilares | Code you own. Context your AI gets. | Código tuyo. Contexto que tu IA entiende. |
| Técnica | Source + rules + MCP, pinned to a commit. | Código + reglas + MCP, anclados a un commit. |
| Lanzamiento (comparativa, temporal) | The package manager for the vibe coding era. | El gestor de paquetes de la era del vibe coding. |
| Seguridad | No postinstall. No surprises. | Sin postinstall. Sin sorpresas. |

**Tagline principal por idioma** (niveles 2 pendientes de revisión nativa):
| Idioma | Tagline |
|---|---|
| en | Install architectures, not dependencies. |
| es | Instala arquitecturas, no dependencias. |
| pt-BR | Instale arquiteturas, não dependências. |
| fr | Installez des architectures, pas des dépendances. |
| de | Installiere Architekturen, keine Abhängigkeiten. |
| ja | 依存関係ではなく、アーキテクチャをインストール。 |
| zh-CN | 安装架构，而非依赖。 |
| ko | 의존성이 아닌, 아키텍처를 설치하세요. |

Seguridad en el mensaje: decimos **"Seguro por diseño, verificable por cualquiera"** / *"Secure by design, verifiable by anyone"*. Nunca "100 % seguro" ni "unhackable" ([security §0](security.md#0-sobre-100--de-seguridad)).

## 7. Voz y tono

**Principios**
1. **Concreto antes que épico.** "Instala auth en 4 s" > "Revoluciona tu desarrollo".
2. **Muestra el comando.** Casi todo mensaje de marketing incluye un bloque de código real.
3. **Honesto con los límites.** Decimos qué no hacemos (no instalamos npm sin permiso, no ejecutamos scripts).
4. **Respeto al lector.** Nada de "simplemente" ni "obviamente".
5. **Errores que ayudan.** Todo error dice qué pasó y **qué hacer** (`fix`).

**Tono por superficie**
| Superficie | Tono | Ejemplo |
|---|---|---|
| CLI | Telegráfico, sin emoji, verbos en pasado al terminar | `✔ Injected 2 packages in 1.8s` |
| Errores | Neutro, causa + solución | `✖ src/lib/auth exists and is not empty.  fix: use --dest src/lib/auth2 or --force (backs up first)` |
| Web | Claro, seguro, algo de chispa en titulares | "Your AI already knows how to use it." |
| Docs | Didáctico, segunda persona, ejemplos primero | "Ejecuta… Verás…" |
| Redes | Cercano, demos en GIF, cero hype vacío | "Le pedí a Claude 'añade Stripe' y esto pasó ↓" |

**Palabras**
| Usar | Evitar |
|---|---|
| inyectar, instalar, anclar, verificar, módulo, arquitectura | revolucionario, mágico, disruptivo, 10x, *simplemente* |
| tu código, tu IA, tu proyecto | "nuestro" código en tu proyecto |
| reglas de IA / AI rules | prompts secretos, magia |

## 8. Identidad visual

> **Concepto: "Anclado".** Un paquete GenPM es confiable porque está anclado a un commit: lo que revisaste es lo que se instala.
> La identidad aplica la misma regla a la forma: cada elemento se apoya en una retícula de líneas de 1 px, nada flota y el color solo
> aparece cuando lleva información. Referencia visual completa: [design/genpm-identidad.html](design/genpm-identidad.html).

**Principios**
1. **Línea, no sombra.** La profundidad se dibuja con bordes de 1 px y espacio. Cero sombras, cero degradados.
2. **El color es dato.** La marca es tinta sobre blanco. Verde, violeta y cian existen solo para las tres capas; ámbar y rojo, solo para estados.
3. **El comando es la imagen.** Sin fotos ni ilustraciones decorativas: comandos, árboles de archivos, SHAs y diagramas de injerto reales.
4. **Un solo elemento vivo.** El caret `▍` es lo único que se anima solo (hero de la home). Todo lo demás se mueve como respuesta a una acción.

**Cambios frente a v0.1:** fondo dark-first → **blanco** (oscuro solo en CLI, terminal, IDE y modo oscuro opcional de la web) ·
color de marca Graft Lime → **tinta** (`#0B0D11`) · Space Grotesk + Inter → **Instrument Sans** · icono de Context `brain` → `file-text`.

### 8.1 Logo

**"Prompt-g"**: wordmark `genpm` en minúsculas, JetBrains Mono ExtraBold (tracking −5 %), seguido de un **caret de bloque** `▍` en `code` (`#5AA300`).
El caret evoca la terminal y lo *generativo* (el cursor que escribe código). Isotipo: `g▍` en blanco sobre un cuadrado de tinta (radio 22 %).

| Versión | Uso |
|---|---|
| Wordmark tinta sobre blanco | Principal: web, docs, README, presentaciones |
| Wordmark blanco sobre tinta | Terminal, avatar, eventos |
| Isotipo `g▍` | App icon, favicon (a 16 px se omite el caret: solo `g`) |
| Monocromo | Caret en tinta o en blanco; único caso en que el caret no es verde |

Reglas: área de respeto = altura de la `g`; mínimo 16 px (isotipo) / 72 px de ancho (wordmark); no mayúsculas, no rotar, no degradados,
no sombras, no cambiar la fuente ni el color del caret. En prosa se escribe **GenPM**; en comandos, URLs y paquetes, `genpm`.

### 8.2 Color

**Light-first.** El fondo es blanco puro. Neutros con un ligero sesgo frío (nunca gris puro). Contrastes WCAG medidos sobre `paper`.

**Neutros**
| Token | Hex | Uso |
|---|---|---|
| `paper` | `#FFFFFF` | Fondo único |
| `wash` | `#F6F7F9` | Bloques de código, hover, nivel 2 |
| `line` | `#E6E8EC` | Borde nivel 1: secciones, tarjetas, tablas |
| `line-2` | `#CDD2D9` | Borde nivel 2: controles (inputs, botones, comandos) |
| `ink-3` | `#6A7180` | Metadatos, etiquetas (4.9:1) |
| `ink-2` | `#4A505C` | Texto secundario (8.2:1) |
| `ink` | `#0B0D11` | Marca, texto principal, CTA primario (19.4:1) |

**Las tres C (color semántico de producto)**
| Capa | Señal (gráficos) | Texto sobre blanco | Superficie oscura | Uso |
|---|---|---|---|---|
| **Code** — Graft Green | `code` `#5AA300` (3.2:1) | `code-ink` `#3B7300` (5.6:1) | `#C4F54A` | Caret del logo, capa Code, éxito |
| **Context** — Signal Violet | `context` `#5B4BDB` (5.6:1) | `#5B4BDB` | `#8B7CFF` | Reglas IA, pestaña "AI Rules", SHA |
| **Connections** — MCP Cyan | `mcp` `#0A7F90` (4.7:1) | `#0A7F90` | `#38D5E8` | MCP, integraciones |

**Estado**
| Token | Light | Oscuro | Uso |
|---|---|---|---|
| `success` | = `code-ink` | = `#C4F54A` | Escaneo superado, verificado |
| `warning` | `#A15F00` | `#F5B83D` | Drift, deprecated, **Sponsored** |
| `danger` | `#C62828` | `#FF6B6B` | Errores, `flagged`, `yanked`, cuarentena |

Reglas:
- **Proporción por pantalla:** paper ~86 % · wash ~4 % · ink ~7 % · capas ≤ 3 %. Si las capas superan el 3 %, la pantalla está sobrecargada.
- `code` (`#5AA300`) nunca como texto: usar `code-ink`. El color de capa va en un marcador (cuadro, nodo, borde); el texto sigue en tinta.
- Botón primario: fondo `ink`, texto `paper`. No hay botones de color.
- Patrocinado: borde y etiqueta `warning`; nunca verde (no debe confundirse con lo oficial/verificado).

### 8.3 Tipografía

| Rol | Fuente | Pesos | Notas |
|---|---|---|---|
| Display y UI | **Instrument Sans** (variable, ejes `wght` y `wdth`) | 400, 500, 600 | Titulares: 600, `wdth` 86–88, tracking −3.5 %. UI: `wdth` 100 |
| Código, datos, wordmark, etiquetas | **JetBrains Mono** | 400, 500, 700, 800 | Ligaduras desactivadas. Etiquetas en mayúscula con +8 % de tracking |

Ambas OFL, en Google Fonts (self-host en producción). Para `ja`, `zh-CN` y `ko`: Noto Sans JP / SC / KR como fuente de texto (Instrument Sans no cubre CJK).

| Token | Tamaño / interlineado | Peso |
|---|---|---|
| `display` | 64 / 0.98 | 600 · wdth 86 |
| `h1` | 40 / 1.02 | 600 · wdth 88 |
| `h2` | 30 / 1.05 | 600 · wdth 88 |
| `h3` | 17 / 1.3 | 600 |
| `body` | 15 / 1.55 | 400 |
| `small` | 13 / 1.5 | 400 |
| `mono` | 12.5 / 1.75 | 400 · 700 |
| `label` | 11 / mayúsculas +8 % | 500 mono |

Cifras siempre con `tabular-nums`. Números grandes abreviados con un decimal en tarjetas: `1.2M`, `12.4k`.

### 8.4 Retícula, elevación, iconografía y motion

- **Retícula:** base 4 px; espaciado 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96; 12 columnas, máx. 1200 px, gutter 24 px (16 px en móvil).
- **Elevación:** nivel 0 = papel · nivel 1 = borde `line` · nivel 2 = borde `line-2` + `wash`. **No existe nivel 3: cero sombras.**
- **Rejilla colapsada:** grupos de tarjetas, pasos y estadísticas comparten bordes en lugar de separarse con huecos.
- **Radio:** 4 px en controles y chips · 0 en secciones · 22 % solo en el isotipo.
- **Iconos:** Lucide, trazo 1.5 px; el color sigue a su capa. `code-2` (Code), `file-text` (Context), `plug` (Connections), `shield-check` (verificado), `git-commit` (SHA).
- **Grafismo:** "líneas de injerto": conectores ortogonales de 1 px con nodos en los extremos, que siempre pasan por el bloque de tinta del SHA. Es el único grafismo.
- **Terminal:** bloques de terminal en HTML real y copiable. En la web van sobre `wash`; en superficies oscuras usan los valores de "Superficie oscura".
- **Motion:** 150–200 ms, `ease-out`; el caret parpadea (1 s, `steps(1)`) solo en el hero; respetar `prefers-reduced-motion`.

### 8.5 Fotografía e imagen
No usamos fotos de stock. Imágenes = terminal, diffs, árboles de archivos y diagramas propios. OG images generadas por paquete (nombre, versión, resumen, badges de las 3 C).

## 9. Mensajes de lanzamiento

**Show HN (título):**
> Show HN: GenPM – a package manager that injects source code, AI rules and MCP into your repo

**Primer párrafo:**
> GenPM installs full modules (auth, billing, email…) as source code into your project instead of node_modules, pinned to a Git commit.
> Each package ships AI rules that load only when your agent works in that folder, plus the MCP servers it needs (with your consent).
> The registry stores only metadata; code comes straight from GitHub. No postinstall scripts. Works from the CLI or conversationally via MCP in Cursor / Claude Code.

**Hilo de X (esqueleto):** 1) GIF "añade login con GitHub" en Claude Code → 2) `genpm.lock` y SHA → 3) reglas con alcance (antes/después de tokens) → 4) consentimiento MCP → 5) "publica el tuyo en 60 s" → 6) enlace.

**Por idioma:** cada lanzamiento se adapta (no se traduce literalmente) para su comunidad: `es` (LATAM y España), `pt-BR` (TabNews, comunidades de dev BR), `ja` (Zenn, Qiita), `zh-CN` (掘金, V2EX), `ko` (GeekNews), `fr`/`de` (comunidades locales de dev). Plantilla base en inglés; los textos en nivel 2 los revisa un nativo antes de publicarse.

**ES (comunidad hispana):**
> Lancé GenPM: en vez de esconder dependencias en node_modules, inyecta módulos completos (código + reglas para tu IA + MCP) en tu proyecto,
> anclados a un commit. Tu IA los entiende, tú los controlas. `npx genpm add @core/auth`

## 10. Marca en el CLI

| Elemento | Especificación |
|---|---|
| Encabezado de comando | `◆ genpm <comando>` (◆ en lime) |
| Prompt | `◇` pendiente → `◆` respondido (estilo @clack/prompts) |
| Éxito | `✔` lime · Aviso `▲` amber · Error `✖` red · Info `›` gris |
| Nombres de paquete | Negrita; versión en gris; SHA corto (7) en violet |
| Capas | `Code` lime · `Rules/Context` violet · `MCP` cyan (mismo sistema que la web) |
| Spinner | Braille (`⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏`), 80 ms |
| `--version` | `genpm 0.1.0 (node 22.x, git 2.4x)` |
| Banner | Solo en `genpm` sin argumentos: `genpm▍  Install architectures, not dependencies.` |
| Sin color | Respeta `NO_COLOR` y no-TTY; los símbolos se mantienen (son ASCII-safe en Windows Terminal; fallback `+ ! x >` en consolas legacy) |

## 11. Badges

Formato shields (`/v1/badge/@core/auth.svg`): izquierda `genpm` sobre `ink`, derecha versión sobre `code` (`#5AA300`) con texto `ink`.
Variantes: `installs` (sobre `wash`), `mcp` (`mcp` con texto blanco), `verified` (`code` con ✓).

## 12. Checklist de activos (para el Día 5–6)

- [ ] Wordmark e isotipo SVG (dark, light, mono) + favicon (`.ico` 32/16, `apple-touch-icon` 180, `icon.svg`)
- [ ] Plantilla OG 1200×630 (home + por paquete, generada en el edge)
- [ ] Avatar de redes (isotipo `g▍` blanco sobre `ink`)
- [ ] Hero del README (SVG animado de terminal o GIF ≤ 2 MB)
- [ ] Badges SVG
- [ ] Tokens de diseño exportados (`tokens.css` / preset Tailwind) — fuente única para web, badges y OG
