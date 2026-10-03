# Roadmap — Sprint MVP de 7 días

> Estado: **plan v0.1** · Fecha: 2026-10-02
> Supuesto de equipo (Q4 en [brainstorming](brainstorming.md)): **2 ingenieros + agentes IA**. Ver §7 para 1 persona.
> Tracks: **A = Plataforma** (registry, auth, web) · **B = Cliente** (core, CLI, MCP) · **C = Contenido** (5 paquetes semilla, docs; ejecutado mayormente por agentes IA y revisado por A/B).

---

## 1. Objetivo del sprint

Al final del Día 7, un desarrollador cualquiera puede:

```bash
claude mcp add genpm -- npx -y @genpm/mcp
# en Claude Code: "Crea la base de un SaaS: base de datos, login con GitHub, suscripciones con Stripe y emails"
```
…y su agente busca, inspecciona e inyecta `@core/db`, `@core/auth`, `@core/billing` y `@core/email` desde el registry público,
con reglas de contexto con alcance, y cablea el resultado siguiendo las reglas — **sin que el humano edite código a mano**.

### Definición de éxito (demo final, grabada)
1. `npx genpm search auth` devuelve resultados del registry en producción en < 1 s.
2. `npx genpm add @core/billing` instala billing + auth + db (dependencias), escribe contexto para Cursor y Claude Code, propone `pnpm add` y no escribe MCP sin consentimiento.
3. En Cursor y Claude Code, la instalación conversacional vía `@genpm/mcp` funciona con el guion anterior.
4. `genpm publish` de un paquete nuevo desde un repo de GitHub aparece en `genpm.net` en < 1 minuto.
5. Los 5 paquetes semilla están publicados, con escaneo `passed`.

## 2. Alcance

| Dentro (MVP) | Fuera (post-MVP) |
|---|---|
| Registry público: search, resolve (+deps), packages, versions, publish, yank, auth device flow, tokens, badge, featured, stats | `update`/`diff` 3-way (v0.2), mirror R2 (v0.3), trusted publishing OIDC (v0.3) |
| CLI: add, search, info, list, remove, outdated, init, validate, publish, yank, login/logout/whoami, mcp setup/add/remove, doctor | GitLab/Bitbucket en publish |
| MCP: search, info, add, list, remove, outdated, validate + resources + prompts | Transporte HTTP remoto |
| Inyección de contexto: AGENTS.md, Claude Code, Cursor, Copilot, Windsurf | Extensión de IDE propia |
| Seguridad: 10 invariantes, firma Ed25519, doble escaneo, `audit`, advisories | Auditoría externa (v0.3), pentest + bug bounty con recompensas (v1.0) |
| 8 idiomas en web y CLI (3 revisados + 5 beta); docs en `en`/`es` | Docs completas en todos los idiomas (+2 semanas) |
| Web: home, búsqueda, página de paquete, publisher, docs, login, tokens, llms.txt | Dashboard de analíticas, compra de patrocinios self-serve |
| 5 paquetes semilla `@core/*` | Recetas `compose` |
| Esquema D1 preparado para SaaS (registry_id, visibility, owner, sponsorships) | RBAC, SSO, registros privados (v1.0) |

## 3. Día 0 — Preparación (antes del lunes, ~3 h)

Decisiones ya tomadas: ver [brainstorming §2](brainstorming.md#2-decisiones-del-fundador-antes-preguntas-abiertas). Acciones del fundador (crear cuentas y pagar):

- [ ] **genpm.net**: ✅ comprado el 2026-10-03 en Piensa Solutions. Falta: DNS en Cloudflare, DNSSEC, renovación automática y 2FA en el registrador (tarea `D0-01`). Subdominios `api.`, `mcp.`, `www`.
- [ ] **genpm.dev** (libre) como dominio defensivo → 301 a genpm.net.
- [ ] Org de GitHub **`GenPM-net`** (✅ creada el 2026-10-03) + **OAuth App** con *Device Flow* + **GitHub App** (solo lectura) para el registry. 2FA obligatorio en la org.
- [ ] Org de npm **`@genpm`** con 2FA obligatorio; reservar el paquete `genpm` (placeholder `0.0.0`); configurar *trusted publishing* para el repo del monorepo.
- [ ] Handles `@genpm` en X, Discord, YouTube y LinkedIn (fallback `genpmnet` / `genpm-net`).
- [ ] Cuenta Cloudflare Workers Paid con llaves FIDO2; D1 `genpm-registry` y `genpm-registry-staging`; dataset de Analytics Engine; Queue para el escaneo.
- [ ] Generar las claves de firma Ed25519 (`k1` activa, `k2` siguiente) y la clave raíz offline de revocación; guardar la raíz fuera de línea.
- [ ] Repo `GenPM-net/genpm` (este monorepo) con protección de `main`, y repos vacíos para las 5 semillas.
- [ ] Contratar revisor nativo de `pt-BR` (Día 6) y buscar revisores para el nivel 2 de idiomas.
- [ ] `security@genpm.net` operativo; secretos en el gestor del equipo; nada en `.env` commiteado.

## 4. Plan día a día

### Día 1 — Cimientos
| Track | Tareas |
|---|---|
| A | Bootstrap monorepo: pnpm, Turborepo, Biome, `@genpm/tsconfig`, Changesets, Vitest. CI GitHub Actions con matriz **ubuntu/macos/windows** × Node 20/22, Actions fijadas por SHA, Semgrep + CodeQL + OSV-Scanner + gitleaks (security §8.1). · `apps/registry`: Hono + `wrangler.jsonc`, migración `0001_init.sql` (staging), middleware `problem+json`, `requestId`, `/v1/health`. Deploy a staging. |
| B | `@genpm/manifest`: esquemas zod (fuente, resuelto, lock, MCP entry), JSON Schema generado, catálogo `E_*`, validadores de nombre/semver/ruta/ref, canonicalización + hash. **Fixtures golden** (válidos e inválidos) compartidos. · `core/fs/safe-path` con tests de fuzzing (rutas Windows, unicode, `..` codificado). · `core/detect` (raíz, clientes IA, package manager). · `@genpm/i18n` (createT, negotiate, format, tipos generados) + lint de literales. |
| C | Fijar stack de semillas (ver `seeds/README.md`); scaffold de `@core/db` y su `AGENTS.md`. |

**DoD:** CI verde en 3 SO · `GET /v1/health` responde en staging · 100 % de ramas cubiertas en `safe-path` y validadores · los fixtures golden validan igual en Node y en Workers.

### Día 2 — Registry y motor de fetch
| Track | Tareas |
|---|---|
| A | Endpoints `search` (FTS5 + ranking), `resolve` (rango, dist-tag, clausura de deps, conflictos), `packages`, `versions`. Cache API + `ETag`. Rate limiting. · `publish` completo (pasos 1–12 de api-spec §4.5) con GitHub App; escáner v1 compartido registry/cliente (prompt-injection, unicode invisible, auto-ejecución, Trojan Source, secretos, colisiones de ruta). Firma Ed25519 de manifiestos + `/v1/keys`. · Seed SQL de staging con 3 paquetes fixture. |
| B | `core/fetch`: git por SHA (sparse + partial clone), verificación `rev-parse`, caché inmutable, fallback tarball, endurecimiento de git (`hooksPath`, `protocol.file.allow`). · `core/plan` (sin escritura) y `core/apply` con journal + rollback, copia con `.genpmignore`, rechazo de symlinks, límites de tamaño, staging + rename atómico. · `core/lock` (formato una-línea-por-paquete, `sg`) + `.genpm/files`. · Verificación de firma (INV-8) y tests de invariantes INV-1…INV-4. |
| C | `@core/db` terminado (tests + tag `v1.0.0`); `@core/auth` en progreso. |

**DoD:** publicar por `curl` un fixture en staging y obtener su SHA vía `resolve` · `plan()+apply()` instalan un fixture en un proyecto temporal · test de rollback (fallo inyectado a mitad de copia deja el disco idéntico) · caché caliente < 100 ms.

### Día 3 — CLI y contexto
| Track | Tareas |
|---|---|
| A | Auth: `POST /v1/auth/github/exchange`, tokens (`gpm_` + checksum, HMAC), `/v1/me`. · CLI lado autor: `login`/`logout`/`whoami` (device flow), `init`, `validate` (reutiliza escáner), `publish`, `yank`. |
| B | `core/inject`: AGENTS.md por paquete + índice raíz, adaptadores `claude`, `cursor`, `copilot`, `windsurf` (bloques gestionados idempotentes), writer de config MCP (merge no destructivo), bloque `.env.example`, propuesta de deps npm. · CLI consumidor: `add` (plan visual + 3 prompts), `search`, `info`, `list` (drift), `remove`, `audit`, `doctor`, `--json` en todos. · Catálogos del CLI `en` + `es`, `--lang`. |
| C | `@core/auth` terminado; `@core/billing` en progreso. Publicar `db` y `auth` en staging con el CLI real (dogfooding de `publish`). |

**DoD:** en un proyecto Hono vacío: `genpm add @core/auth` instala auth + db desde staging en macOS, Linux y Windows CI · re-ejecutar `add` es idempotente (`skip`) · `remove` con drift falla con `E_DRIFT` y `fix` · snapshots de salida humana y JSON.

### Día 4 — Servidor MCP
| Track | Tareas |
|---|---|
| A | Cron triggers (rollup Analytics Engine → D1, popularidad, patrocinios, auditoría de tags) · `/v1/featured`, `/v1/stats`, `/v1/badge` · tests de seguridad: path traversal vía `d`, ref de rama, typosquatting, payloads grandes, FTS injection, suite cross-tenant (INV-10). · `/v1/advisories`. · Bot de traducción + checks de i18n en CI; generar `pt-BR` y nivel 2. |
| B | `@genpm/mcp`: tools (`search`, `info`, `add` con `dryRun`/`planId`, `list`, `remove`, `outdated`, `audit`, `validate`), reglas delimitadas como contenido de terceros, `instructions`, resources, prompts, raíces vía `roots/list`, candado `.genpm/.lock`. Tests de contrato con `InMemoryTransport`. · `genpm mcp setup/add/remove` (adaptadores por cliente). · Pruebas reales en **Claude Code** y **Cursor**. |
| C | `@core/billing` (con `m` de Stripe) y `@core/email` terminados; `@core/ai` en progreso. Scaffold de `apps/web` (Astro + Tailwind con tokens de [branding](branding.md)). |

**DoD:** en Claude Code y Cursor, el prompt "añade login con GitHub" termina con el módulo instalado y la tool `genpm_add` llamada primero con `dryRun:true` · respuestas de tools < 1 500 tokens (test automatizado con un tokenizador aproximado).

### Día 5 — Web MVP y pulido del cliente
| Track | Tareas |
|---|---|
| A + C | `apps/web` ([web-ui-spec](web-ui-spec.md) — prioridad P0): Home, Búsqueda, Página de paquete (tabs Overview/Reglas IA/Archivos/Versiones/Seguridad), Publisher, Login GitHub, Tokens, Docs (Starlight con `/docs`), `llms.txt` + `/p/<name>.md`, OG images, **routing de 8 idiomas** (selector, hreflang, fuentes CJK), `/security/advisories`, `security.txt`. Deploy a staging con Service Binding. |
| B | `outdated` · mensajes de error con `fix` revisados uno a uno · rendimiento (`add` frío < 5 s) · empaquetado con tsdown, `npx` en frío < 2 s · `npm publish --provenance` en dry-run. |
| C | `@core/ai` terminado; las 5 semillas publicadas en staging; prueba de aceptación de agente por semilla (§5). |

**DoD:** Lighthouse ≥ 95 (performance, accesibilidad, SEO) en home y página de paquete · las 5 semillas pasan la prueba de aceptación.

### Día 6 — Integración, seguridad y producción
- **Dogfooding total** (todos): crear 2 apps desde cero (Hono + Next) solo con el MCP en Claude Code y Cursor; registrar cada fricción como issue; arreglar P0/P1.
- **Puertas de seguridad** ([security §10](security.md#10-puertas-de-seguridad-del-lanzamiento-día-6)): sin todas en verde no hay lanzamiento.
- **Idiomas**: revisión nativa de `pt-BR`, legal y `security.txt` en nivel 1, capturas con pseudo-locale.
- Producción: migraciones D1 prod, dominios `api.genpm.net` / `genpm.net`, secretos, rate limits, alertas (errores 5xx > 1 %, latencia p95).
- Publicar las 5 semillas en **prod** con el CLI; marcar `@core/*` como featured y el scope como verificado.
- `npm publish` de `genpm@0.1.0` y `@genpm/mcp@0.1.0` (con provenance).
- Docs: README, Quickstart (60 s), Guía de publicación, Referencia del manifiesto, Config MCP por cliente.

**DoD:** checklist de seguridad sin ítems abiertos de severidad alta · instalación desde npm público funciona en máquina limpia.

### Día 7 — Lanzamiento
- Vídeo demo de 90–120 s (guion §1). GIFs para README.
- Copys de lanzamiento ([branding §9](branding.md#9-mensajes-de-lanzamiento)): Show HN, hilo en X, post en LinkedIn, comunidad hispana.
- Monitorización en vivo durante el lanzamiento; un responsable de soporte en GitHub Issues/Discord.
- Retro + priorización v0.2 (update/diff asistido por IA).

## 5. Paquetes semilla — criterio de aceptación

Detalle de cada paquete en [`seeds/README.md`](../seeds/README.md). Cada semilla está **terminada** cuando:
1. Repo público con `genpm.json`, `AGENTS.md` (secciones Propósito / Mapa / Integración / Convenciones / No hacer), `LICENSE` MIT, tests en verde, tag `v1.0.0`.
2. `genpm validate` sin errores; reglas ≤ 1 500 tokens.
3. **Prueba de agente:** en un proyecto Hono vacío, Claude Code con solo el prompt *"Instala @core/X con genpm e intégralo"* deja la app compilando y los tests del módulo pasando en < 10 minutos, sin edición humana. Se repite en Cursor.

## 6. Camino crítico

```
D1 manifest ──► D2 core/fetch+apply ──► D3 inject+CLI add ──► D4 MCP ──► D6 dogfooding ──► D7 launch
D1 D1 schema ──► D2 resolve+publish ──► D3 auth+publish CLI ─┘                 ▲
D1 seeds stack ──► D2–D5 5 semillas ────────────────────────────────────────────┘
                     D4 web scaffold ──► D5 web MVP ─────────────────────────────┘
```
El riesgo principal está en **D2–D3 del track B** (fetch + apply + inyección). Si al final del D3 `add` no funciona de punta a punta, se activa el recorte.

## 7. Plan de recorte (en este orden)

1. Adaptadores Copilot y Windsurf → solo AGENTS.md + Claude Code + Cursor.
2. Web: Publisher, Tokens y OG images → solo Home, Búsqueda, Paquete y Docs.
3. `outdated`, `yank`, `doctor`, `mcp add/remove` → v0.1.1.
4. Fallback tarball → exigir `git`.
5. Resolución de dependencias `g` → el CLI lista las dependencias y pide instalarlas explícitamente.
6. 5 semillas → 3 (`db`, `auth`, `billing`).
**Nunca se recorta:** los 10 invariantes de seguridad, la firma de manifiestos, el escaneo (registry y cliente), las puertas de seguridad del Día 6 y los idiomas de nivel 1 (`en`, `es`, `pt-BR`). Si hay que recortar idiomas, el nivel 2 se lanza una semana después.

**Si el equipo es de 1 persona:** el sprint pasa a 10 días hábiles; aplicar recortes 1–3 desde el inicio y delegar el track C entero a agentes IA con revisión diaria de 1 h.

## 8. Riesgos del sprint

| Riesgo | Señal temprana | Respuesta |
|---|---|---|
| Fetch por SHA falla en algún host/proxy corporativo | Tests D2 | Fallback tarball (no recortar si aparece) |
| Formatos de reglas/MCP de los IDEs cambiaron | Pruebas reales D4 | Adaptadores aislados; priorizar AGENTS.md (estándar abierto) |
| Rate limits de GitHub en publish masivo de semillas | D5 | Token de instalación de la GitHub App; publicar escalonado |
| Agente no integra bien una semilla | Prueba de aceptación D5 | Mejorar `AGENTS.md` (es contenido, no código) — iterar es barato |
| Windows | CI D1 | Matriz desde el día 1, no al final |

## 9. Métricas de lanzamiento (primeras 2 semanas)

| Métrica | Objetivo |
|---|---|
| Instalaciones (`resolve` únicos por proyecto) | 1 000 |
| % de instalaciones vía MCP | ≥ 30 % (valida la tesis "conversacional") |
| Paquetes publicados por terceros | 25 |
| Publishers distintos | 15 |
| Estrellas del repo | 500 |
| Errores `E_INTERNAL` / instalaciones | < 0,5 % |

## 10. Después del MVP

| Versión | Horizonte | Contenido |
|---|---|---|
| **v0.2** | +2 semanas | `diff` + `update` 3-way, `genpm_diff` (actualizaciones asistidas por IA), dependents ("usado por"), puntuación de calidad |
| **v0.3** | +6 semanas | Trusted publishing (OIDC de GitHub Actions), mirror R2 "Verified Archive", GitLab, transporte MCP HTTP solo lectura, `compose` (recetas) |
| **v1.0 — SaaS** | +3 meses | Registros privados (shared tenancy) con RBAC (`teams`, `package_grants`), SSO, dominio propio, auditoría exportable, facturación Stripe, patrocinios self-serve |
| **Enterprise** | +6 meses | Tenancy dedicada (D1 por cliente vía Workers for Platforms), SCIM, políticas (paquetes permitidos, escaneo obligatorio), SLA |
