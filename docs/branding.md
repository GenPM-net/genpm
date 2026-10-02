# GenPM — Guía de marca

> Estado: **v0.1** · Fecha: 2026-10-02 · Alcance: nombre, posicionamiento, mensajes, voz, identidad visual, CLI y lanzamiento.
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
  | Web | **genpm.com** (+ `genpm.dev` → redirección) |
  | npm | `genpm` (CLI) y org `@genpm` |
  | GitHub | `genpmhq` (`genpm` está ocupado por una cuenta inactiva; intentar recuperarlo) |
  | X / Discord / YouTube / LinkedIn | `@genpm` (fallback `genpmhq`) |
  | Email | `hello@`, `security@`, `sponsors@` `genpm.com` |
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

### 8.1 Logo

**Dirección recomendada para el MVP — "Prompt-g"**: wordmark `genpm` en minúsculas, JetBrains Mono ExtraBold, seguido de un **caret de bloque** `▍`
en Graft Lime. El caret evoca la terminal y lo *generativo* (el cursor que escribe). Isotipo: `g▍` dentro de un cuadrado redondeado (radio 22 %).
Funciona a 16 px (favicon) y en monocromo.

**Dirección alternativa (v1) — "Graft"**: dos rectángulos redondeados desplazados (tu proyecto y el módulo) unidos por un nodo circular: el injerto.
Más ilustrativa; requiere diseñador.

Reglas: área de respeto = altura de la `g`; tamaño mínimo 16 px (isotipo) / 72 px de ancho (wordmark); no rotar, no degradados, no sombras,
no cambiar el color del caret salvo versión monocroma.

### 8.2 Color

Dark-first (nuestro público vive en terminales y editores oscuros). Contrastes WCAG medidos contra los fondos indicados.

**Neutros**
| Token | Hex | Uso |
|---|---|---|
| `ink-950` | `#0A0B0D` | Fondo dark |
| `ink-900` | `#111317` | Superficies (cards, code blocks) dark / texto principal light (17.3:1 sobre paper) |
| `ink-800` | `#1A1D23` | Superficie elevada dark |
| `ink-600` | `#3A3F4A` | Bordes dark |
| `ink-500` | `#5A606C` | Texto secundario light (5.9:1) |
| `ink-300` | `#A3A9B6` | Texto secundario dark (8.4:1) |
| `ink-100` | `#EDEEF0` | Texto principal dark (17.0:1) |
| `paper` | `#F7F7F2` | Fondo light |

**Las tres C (color semántico de producto)**
| Capa | Token dark (sobre `ink-950`) | Token light (sobre `paper`) | Uso |
|---|---|---|---|
| **Code** — Graft Lime (color de marca) | `lime-400` `#C4F54A` (15.5:1) | `lime-700` `#4A7300` (5.2:1) | Primario, CTAs, caret del logo, éxito en CLI, todo lo relativo a código |
| **Context** — Signal Violet | `violet-400` `#8B7CFF` (6.0:1) | `violet-700` `#5B4BDB` (5.6:1) | Reglas IA, pestaña "AI Rules", badges de contexto |
| **Connections** — MCP Cyan | `cyan-400` `#38D5E8` (11.1:1) | `cyan-700` `#0E7C8C` (4.6:1) | MCP, integraciones, badge "mcp" |

**Estado**
| Token | Dark | Light | Uso |
|---|---|---|---|
| `warning` | `#F5B83D` (11.1:1) | `#9A6400` (4.7:1) | Avisos, drift |
| `danger` | `#FF6B6B` (7.1:1) | `#C92A2A` (5.1:1) | Errores, escaneo `flagged`, yanked |
| `success` | = lime | = lime-700 | — |

Regla: **Graft Lime nunca como color de texto sobre fondos claros** (1.18:1) — usar `lime-700`. Botón primario: fondo lime, texto `ink-950`.
Patrocinado: borde `warning` + etiqueta "Sponsored"; nunca lime (no debe confundirse con lo oficial/verificado).

### 8.3 Tipografía

| Rol | Fuente | Pesos | Notas |
|---|---|---|---|
| Display (titulares) | **Space Grotesk** | 500, 700 | Tracking −2 % en tamaños > 40 px |
| UI y texto | **Inter** | 400, 500, 600 | `font-feature-settings: "cv11","ss01"` |
| Código, comandos, wordmark | **JetBrains Mono** | 400, 700, 800 | Ligaduras desactivadas en comandos copiables |

Todas OFL, disponibles en Google Fonts (self-host en producción). Para `ja`, `zh-CN` y `ko`: Noto Sans JP / SC / KR como fuente de texto (Space Grotesk e Inter no cubren CJK). Escala (rem): 0.75 · 0.875 · 1 · 1.125 · 1.25 · 1.5 · 2 · 2.75 · 3.75.

### 8.4 Iconografía, grafismos y motion

- Iconos: **Lucide** (trazo 1.5 px, esquinas redondeadas). Iconos de capa: `code-2` (Code), `brain` (Context), `plug` (Connections), `shield-check` (verificado), `git-commit` (SHA).
- Grafismo: rejilla de puntos sutil + "líneas de injerto" (conectores ortogonales con nodos) para diagramas e ilustraciones de la home.
- Bloques de terminal como elemento visual protagonista (no capturas: HTML real, copiable).
- Motion: 150–250 ms, `ease-out`; el caret parpadea (1 s, `steps(1)`) solo en el hero; respetar `prefers-reduced-motion`.

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

Formato shields (`/v1/badge/@core/auth.svg`): izquierda `genpm` sobre `ink-900`, derecha versión sobre `lime-400` con texto `ink-950`.
Variantes: `installs`, `mcp` (cyan), `verified` (lime con ✓).

## 12. Checklist de activos (para el Día 5–6)

- [ ] Wordmark e isotipo SVG (dark, light, mono) + favicon (`.ico` 32/16, `apple-touch-icon` 180, `icon.svg`)
- [ ] Plantilla OG 1200×630 (home + por paquete, generada en el edge)
- [ ] Avatar de redes (isotipo sobre `ink-950`)
- [ ] Hero del README (SVG animado de terminal o GIF ≤ 2 MB)
- [ ] Badges SVG
- [ ] Tokens de diseño exportados (`tokens.css` / preset Tailwind) — fuente única para web, badges y OG
