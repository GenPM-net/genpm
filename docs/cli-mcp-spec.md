# Especificación del CLI (`genpm`) y del servidor MCP (`@genpm-net/mcp`)

> Estado: **v1 (MVP)** · Fecha: 2026-10-02
> Ambos son fachadas de `@genpm/core`: misma resolución, mismo plan, mismos errores. Lo único que cambia es la presentación.
> Relacionados: [architecture §6–7](architecture.md) · [manifest-spec](manifest-spec.md) · [api-spec](api-spec.md)

---

## 0. Contrato compartido (core)

```ts
// @genpm/core — API pública que consumen CLI y MCP
export function plan(input: PlanInput): Promise<InstallPlan>;            // solo lectura
export function apply(plan: InstallPlan, opts: ApplyOptions): Promise<ApplyResult>;
export function search(q: SearchInput): Promise<SearchResult>;
export function info(name: string, range?: string): Promise<PackageInfo>;
export function list(cwd: string): Promise<InstalledPackage[]>;
export function remove(input: RemoveInput): Promise<RemoveResult>;
export function outdated(cwd: string): Promise<OutdatedEntry[]>;
export function audit(cwd: string): Promise<AuditReport>;
export function validate(path: string): Promise<ValidationReport>;
export function publish(input: PublishInput): Promise<PublishResult>;

type PlanInput = {
  specs: string[];               // '@core/auth', '@core/auth@^1.2', 'gh:owner/repo#v1.0.0'
  cwd: string;
  dest?: string;                 // solo válido con un único spec
  clients?: Client[];            // override de detección: 'agents'|'claude'|'cursor'|'copilot'|'windsurf'
  force?: boolean;
};

type InstallPlan = {
  id: string;                    // sha256 del plan; apply() rechaza si el disco cambió desde plan() (E_PLAN_STALE)
  root: string;                  // raíz del proyecto detectada
  packages: Array<{
    n: string; v: string; c: string; d: string;
    role: 'root' | 'dep';
    action: 'install' | 'skip' | 'conflict';
    reason?: string;             // 'already installed 1.0.3 (satisfies ^1.0.0)'
    files: number; bytes: number;
  }>;
  context: Array<{ file: string; op: 'create' | 'update' }>;
  mcp: Array<{ n: string; command: string; env: string[]; targets: string[]; from: string }>;
  npm: { manager: 'pnpm' | 'npm' | 'yarn' | 'bun' | null; add: Record<string, string>; command: string | null };
  env: string[];
  rulesPreview: Array<{ n: string; excerpt: string; tokens: number; scan: 'passed' | 'flagged' }>;
  conflicts: Array<{ code: ErrorCode; n?: string; path?: string; detail: string; fix: string }>;
  warnings: Array<{ code: string; detail: string }>;
};

type ApplyOptions = { allowMcp: boolean; installNpmDeps: boolean; by: 'cli' | 'mcp' };

type ApplyResult = {
  ok: true;
  installed: Array<{ n: string; v: string; c: string; d: string }>;
  written: string[];             // rutas relativas creadas/modificadas
  mcpWritten: string[];          // archivos de config MCP tocados ([] si no hubo consentimiento)
  npmRan: boolean;
  durationMs: number;
  next: string[];                // pasos sugeridos legibles por humanos y LLMs
};
```

**Concurrencia:** `apply`, `remove` y `update` toman un candado `.genpm/.lock` (PID + timestamp; se considera huérfano tras 10 min).
Si CLI y MCP intentan escribir a la vez ⇒ `E_BUSY`.

**Errores:** todos los fallos son `GenpmError { code, message, fix, details? }`. `fix` es una instrucción accionable
(pensada para que un LLM pueda recuperarse sin preguntar al humano cuando sea seguro).

---

# Parte A — CLI

## A.1 Instalación y uso

Opción principal: **binario nativo** (ADR-025), sin Node.js. Los comandos empiezan directamente por `genpm`.

```bash
curl -fsSL https://genpm.net/install.sh | sh        # macOS y Linux
irm https://genpm.net/install.ps1 | iex             # Windows (PowerShell)
genpm add @core/auth
```

Alternativas con Node ≥ 20.11 (mismo CLI, mismo bundle):

```bash
npm i -g @genpm-net/cli                    # global
npx @genpm-net/cli add @core/auth          # puntual, sin instalación (CI)
```

| Plataforma | Binarios (GitHub Releases) |
|---|---|
| macOS | `genpm-darwin-arm64`, `genpm-darwin-x64` |
| Linux | `genpm-linux-{x64,arm64}`, `genpm-linux-{x64,arm64}-musl` |
| Windows | `genpm-windows-x64.exe`, `genpm-windows-arm64.exe` |

Los instaladores (`scripts/install/install.{sh,ps1}`, servidos en `genpm.net/install.*`) detectan SO, arquitectura,
Rosetta y musl; verifican el SHA-256 contra `SHA256SUMS` del release; instalan en `~/.genpm/bin` sin `sudo` y añaden esa
carpeta al `PATH` (perfil del shell o `PATH` de usuario en Windows). Variables: `GENPM_VERSION`, `GENPM_INSTALL_DIR`,
`GENPM_NO_MODIFY_PATH=1`, `GENPM_DOWNLOAD_URL` (mirrors). Documentación de usuario: `genpm.net/docs/install`.

Requisitos: ninguno con el binario (Node ≥ 20.11 con npm/npx); `git` ≥ 2.25 recomendado (sin git se usa el fallback
tarball, solo GitHub).

## A.2 Opciones globales

| Flag | Env | Descripción |
|---|---|---|
| `--cwd <dir>` | `GENPM_CWD` | Directorio de trabajo (default: `process.cwd()`; la raíz se busca hacia arriba: `genpm.lock` → `.git` → `package.json`). |
| `--registry <url>` | `GENPM_REGISTRY` | Registry (default `https://api.genpm.net`; por scope vía `.genpmrc`). |
| `--json` | — | Salida JSON en stdout (una sola línea), sin colores ni prompts; logs a stderr. |
| `-y, --yes` | `GENPM_YES=1` | Acepta prompts de instalación de código. **No** implica `--mcp` ni `--install-deps`. |
| `--lang <locale>` | `GENPM_LANG` | Idioma de la salida humana (`en`, `es`, `pt-BR`, `fr`, `de`, `ja`, `zh-CN`, `ko`). Default: locale del sistema. `--json` es siempre inglés. Ver [i18n §3](i18n.md#3-superficies-y-negociación-del-idioma). |
| `--verbose` | `GENPM_DEBUG=1` | Logs de depuración (comandos git, tiempos, requests). |
| `--no-color` | `NO_COLOR` | Sin ANSI. |
| `-q, --quiet` | — | Solo errores. |
| — | `GENPM_TOKEN` | Token para CI (prioridad sobre `~/.genpm/auth.json`). |
| — | `GENPM_CACHE_DIR` | Caché (default `~/.genpm/cache`). |
| — | `GENPM_TELEMETRY=0` / `DO_NOT_TRACK=1` | Desactiva el conteo anónimo (envía `client=none`, el registry no registra el evento). `--dry-run` y la vista previa `dryRun` del MCP tampoco cuentan. |

Precedencia de configuración: flags > env > `.genpmrc` del proyecto > `~/.genpmrc` > defaults.
En modo no interactivo (no TTY o `--json`) cualquier prompt sin respuesta por flag ⇒ `E_CONFIRM_REQUIRED` (exit 2).

## A.3 Códigos de salida

| Exit | Significado | Códigos típicos |
|---|---|---|
| 0 | OK | — |
| 1 | Error genérico / interno | `E_INTERNAL` |
| 2 | Uso incorrecto / falta confirmación | `E_USAGE`, `E_CONFIRM_REQUIRED` |
| 3 | No encontrado | `E_NOT_FOUND`, `E_NO_MATCHING_VERSION` |
| 4 | Conflicto | `E_DEST_CONFLICT`, `E_RANGE_UNSATISFIED`, `E_ALREADY_INSTALLED`, `E_DRIFT`, `E_BUSY`, `E_PLAN_STALE` |
| 5 | Red / upstream | `E_NETWORK`, `E_UPSTREAM_GIT`, `E_RATE_LIMITED`, `E_READ_ONLY` |
| 6 | Seguridad / integridad | `E_INTEGRITY`, `E_SIGNATURE`, `E_PATH_UNSAFE`, `E_AUTORUN_FILE`, `E_SCAN_FAILED`, `E_INSECURE_PERMS`, `E_QUARANTINED`, `E_REF_MUTABLE`, `E_ADVISORY`, `E_UPGRADE_INTEGRITY` |
| 7 | Autenticación / permisos | `E_AUTH`, `E_FORBIDDEN_SCOPE` |
| 8 | Entorno | `E_GIT_MISSING`, `E_NODE_VERSION`, `E_NOT_A_PROJECT`, `E_UPGRADE_UNSUPPORTED`, `E_UPGRADE_PERMISSION`, `E_MCP_SERVE_UNAVAILABLE` |

## A.4 Gramática de specs

| Spec | Significado | MVP |
|---|---|---|
| `@scope/name` | `latest` | ✅ |
| `@scope/name@1.2.0` | Versión exacta | ✅ |
| `@scope/name@^1.2` / `@~1.2.3` / `@>=1 <2` | Rango semver | ✅ |
| `@scope/name@next` | Dist-tag | ✅ |
| `gh:owner/repo#<tag\|sha>` | Directo desde GitHub sin registry (lee `genpm.json` del repo) | ✅ P1 |
| `git+https://host/owner/repo#<tag\|sha>` | Directo desde cualquier host Git | ⏳ |
| `file:../ruta` | Desarrollo local de autores (lock marca `"t":"file:…"`, sin garantía de inmutabilidad) | ✅ P1 |

Specs directos **requieren** `#<tag|sha>`; `gh:owner/repo` sin ref ⇒ `E_REF_MUTABLE`.

## A.5 Comandos — consumidor

### `genpm add <spec...>` ✅

Inyecta uno o más paquetes (y sus dependencias `g`).

| Flag | Default | Descripción |
|---|---|---|
| `--dest <dir>` | `d` del manifiesto | Destino alternativo (solo con un spec). |
| `--dry-run` | `false` | Muestra el plan y sale (exit 0). |
| `--mcp` | `false` | Escribir config MCP sin preguntar. |
| `--no-mcp` | — | No escribir config MCP ni preguntar. |
| `--install-deps` / `--no-install-deps` | pregunta | Ejecutar (o no) el comando npm propuesto sin preguntar. Sin ninguno: se pregunta en TTY y no se ejecuta fuera de TTY. |
| `--clients <list>` | detección | `agents,claude,cursor,copilot,windsurf`. |
| `--force` | `false` | Sobrescribir destino no vacío (backup en `.genpm/backup/<ts>/`). |
| `--allow-autorun` | `false` | Permitir archivos de auto-ejecución (security §3.1). Solo paquetes de publishers verificados; aviso en rojo. |

Comportamiento:
0. Verificar la firma del manifiesto resuelto (INV-8) y, tras el fetch, el SHA (INV-1) y el **escaneo local** con las mismas reglas deterministas del registry (security §3.1). Cualquier fallo aborta con exit 6.
1. `plan()` → si hay `conflicts` y no `--force` ⇒ imprime cada conflicto con su `fix` y sale con exit 4.
2. Muestra el plan (abajo) incluido el resumen de reglas (`rulesPreview`); si `scan = flagged` muestra advertencia roja.
3. Prompt 1: inyectar código. Prompt 2 (solo si hay `m`): config MCP, mostrando **el comando completo**. Prompt 3 (solo si hay `p` no satisfechos): comando npm.
4. `apply()`; ante error, rollback y mensaje con `fix`.

Salida humana:
```
◆ genpm add @core/billing

  Resolved
  ├─ @core/billing  1.2.0  9f2c4e1  → src/lib/billing
  ├─ @core/auth     1.2.0  1b9d3a0  → src/lib/auth      dependency
  └─ @core/db       1.0.3  77ac0d2  → skip              already installed (satisfies ^1.0.0)

  Rules      2 files · ~1.4k tokens · scan passed            (genpm info <pkg> to read)
  Context    src/lib/*/AGENTS.md · .cursor/rules ×2 · AGENTS.md index
  npm        stripe@^17.0.0 arctic@^3.0.0                     → pnpm add …
  Env        STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET AUTH_SECRET → .env.example
  MCP        stripe: npx -y @stripe/mcp           (env: STRIPE_SECRET_KEY)

◇ Inject 2 packages (47 files, 112 KB)? Yes
◇ Add MCP server "stripe" to .cursor/mcp.json and .mcp.json? No
◇ Run `pnpm add stripe@^17.0.0 arctic@^3.0.0`? Yes

✔ Injected 2 packages in 1.8s
  Next
  › Set STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, AUTH_SECRET (see .env.example)
  › Follow "Integración" in src/lib/billing/AGENTS.md
  › Enable MCP later: genpm mcp add @core/billing
```

`--json`: `{"ok":true,"plan":InstallPlan,"result":ApplyResult}` · con `--dry-run`: `{"ok":true,"plan":InstallPlan}` · error: `{"ok":false,"error":{"code","message","fix","details"}}`.

### `genpm search [query]` ✅

| Flag | Descripción |
|---|---|
| `-k, --keyword <kw>` | Filtrar por keyword (repetible). |
| `--mcp` | Solo paquetes con servidores MCP. |
| `--sort relevance\|installs\|recent` | Orden. |
| `-n, --limit <n>` | Default 10, máx. 50. |

Sin query ⇒ destacados + populares. En TTY muestra como máximo 1 resultado patrocinado, separado y etiquetado (ADR-010); nunca en `--json`.
```
  @core/auth       1.2.0  Sessions + OAuth (GitHub, Google) with Drizzle      ✓ 1.5k/30d
  @core/billing    1.2.0  Stripe subscriptions, portal & webhooks        mcp ✓   890/30d
  @acme/clerk-kit  0.4.1  Clerk wrapper with org-aware middleware                120/30d
  ─ Sponsored ─
  @vendor/obs      2.1.0  Tracing + logs in 1 command
```
`--json` ⇒ formato compacto de `/v1/search?fmt=c`.

### `genpm info <name>[@range]` ✅

Muestra manifiesto resuelto en forma larga, dependencias, MCP, env, licencia, estado de escaneo, versiones recientes y **las reglas completas** (paginadas con `less` en TTY). `--rules` imprime solo `x`. `--json` ⇒ `PackageInfo` (manifiesto compacto + `rules` completas + `installed: {v, drift}` si está en el proyecto).

### `genpm list` (`ls`) ✅

```
  @core/auth   1.2.0  src/lib/auth   1b9d3a0   3 files changed
  @core/db     1.0.3  src/lib/db     77ac0d2   clean
```
Drift = comparación de hashes con `.genpm/files/<slug>.json`. `--json` ⇒ `[{n,v,c,d,drift:{modified:[…],deleted:[…],added:[…]}}]`.

### `genpm remove <name>` (`rm`) ✅

1. Si hay drift y no `--force` ⇒ `E_DRIFT` (fix: `--keep-code` o `--force`).
2. Si otro paquete instalado lo tiene en `g` ⇒ `E_REQUIRED_BY` (fix: eliminar primero el dependiente).
3. Borra `d` (salvo `--keep-code`), entradas de contexto (bloques gestionados y archivos `genpm-<slug>.*`), entrada del lock y `.genpm/files/<slug>.json`.
4. Config MCP: **no** la toca automáticamente; lista los servidores añadidos por ese paquete y sugiere `genpm mcp remove`.

### `genpm outdated` ✅

Compara el lock con `resolve?range=latest` (en paralelo, máx. 8 concurrentes):
```
  @core/auth   1.2.0 → 1.3.1   minor   3 files changed locally
  @core/db     1.0.3 → 2.0.0   major   clean
```
Exit 0 aunque haya desactualizados (`--exit-code` ⇒ exit 4 si hay alguno, útil en CI).

### `genpm audit` ✅

Verifica el proyecto: hashes en disco vs `.genpm/files` (drift esperado vs manipulación), firma `sg` de cada entrada del lock, advisories, versiones retiradas y cuarentenas (`GET /v1/advisories`).
```
  ✖ @core/auth 1.2.0   GENPM-2026-0007 high   session fixation in session.ts → fixed in 1.2.1
  ▲ @core/db   1.0.3   yanked: "migration bug"  → 1.0.4
  ✔ 3 packages · signatures valid
```
Exit 6 si hay advisory alta/crítica o firma inválida. `--json` ⇒ `{ok, findings:[{n,v,kind:'advisory'|'yanked'|'quarantined'|'signature'|'tamper',severity,id,fix}]}`. Recomendado en el CI del proyecto del usuario.

### `genpm diff <name> [--to <range>] [--local]` ✅

Diff unificado upstream `c_instalado..c_nuevo` remapeado a `d` (rutas `a/<d>/…` y `b/<d>/…`) por stdout, consumible por `git apply --3way` desde la raíz; la cabecera y `--local` (drift) van por stderr. No cuenta como instalación (`client=none`). `--json` ⇒ `{n,d,from,to,patch,files,omitted,drift}`.

### `genpm update <name…> [--to <range>] [--dry-run] [--mcp] [--install-deps]` ✅

Merge de 3 vías (ver [architecture §6.6](architecture.md#66-actualización-con-drift)): plan con `action: 'update'` y `from`, misma confirmación y consentimientos que `add` (MCP y npm nuevos), dependencias nuevas se instalan y las que ya satisfacen el rango se dejan. Archivos con conflicto quedan con marcadores `<<<<<<< local` / `>>>>>>> upstream` y se listan; exit 4 si hubo conflictos. Un paquete no instalado ⇒ `E_NOT_FOUND`. `add` de una versión distinta de un paquete instalado sigue dando `E_ALREADY_INSTALLED` con `fix: genpm update`.

### `genpm mcp serve` ✅

Servidor MCP por stdio (Parte B) dentro del CLI: es lo que lanzan los clientes de IA cuando GenPM está instalado como
binario nativo, sin Node ni npx (ADR-025). Nunca escribe en stdout fuera del protocolo. Solo existe en el binario: el
paquete de npm no lo incluye (~550 KB más en cada `npx` en frío) y responde `E_MCP_SERVE_UNAVAILABLE` con `npx -y @genpm-net/mcp` en `fix`.

### `genpm mcp setup [--client <c>] [--scope project|user]` ✅

Registra el servidor MCP de GenPM en el cliente IA (`genpm mcp serve` con el binario nativo; `npx -y @genpm-net/mcp` desde npm/npx) (escritura de archivo con merge no destructivo; muestra diff y pide confirmación). Ver §B.7.

### `genpm mcp add|remove <name>` ✅

Escribe/borra la config MCP declarada por un paquete instalado (consentimiento diferido).

### `genpm doctor` ✅

Comprueba: runtime (binario nativo y su plataforma, o versión de Node), `git` disponible y versión, raíz del proyecto, clientes IA detectados, alcance al registry (latencia), estado de login, coherencia de `genpm.lock` vs disco (dirs inexistentes, `.genpm/files` huérfanos). Cada check: `✔`/`▲`/`✖` + `fix`.

### `genpm cache dir|clean` P2

### `genpm upgrade [version] [--check]` ✅

Actualiza el binario nativo (ADR-025). `latest` se lee de la redirección de `github.com/genpm-net/genpm-releases/releases/latest`
(sin gastar cuota de la API). Descarga `SHA256SUMS` y el binario de su plataforma (grabada en compilación), verifica el
SHA-256 y reemplaza el ejecutable con `rename` atómico en su directorio; en Windows renombra el `.exe` en uso a `.old`
(se borra en el siguiente arranque). Checksum distinto ⇒ `E_UPGRADE_INTEGRITY` sin tocar nada; sin permiso de escritura ⇒
`E_UPGRADE_PERMISSION`. Con versión explícita permite volver atrás. `--check` solo informa (también desde npm/npx).
Instalado con npm/npx ⇒ `E_UPGRADE_UNSUPPORTED` con el comando de su gestor en `fix`. `--json` ⇒
`{ok, current, latest, upToDate, method}` o `{ok, from, to, path, sha256}`. No hay comprobaciones automáticas en
segundo plano: GenPM solo contacta con GitHub cuando se ejecuta este comando.

## A.6 Comandos — autor

### `genpm init` ✅

Wizard en un repo de paquete: pregunta `n`, `v` (default `0.1.0`), `s`, `d`, `k`, `l` (detecta `LICENSE`); crea `genpm.json` (pretty), `AGENTS.md` desde la plantilla ([manifest-spec §11](manifest-spec.md#11-plantilla-de-reglas-para-autores-agentsmd-del-paquete)) si no existe, `.genpmignore` con defaults, y opcionalmente `.github/workflows/genpm-publish.yml` (publica al empujar tags `v*`). `--yes` usa defaults inferidos.

### `genpm validate [path]` ✅

Valida `genpm.json` (zod), existencia y tamaño de `x`, `i` válido, que `x` está dentro de `i`, estimación de tokens de las reglas, lista de archivos que se inyectarían (aplicando `.genpmignore`), symlinks (error), archivos > 1 MB (aviso), patrones de secretos (aviso), y el mismo escáner de prompt-injection que el registry (para no llevarse sorpresas). Exit 0/6.

### `genpm publish` ✅

| Flag | Default | Descripción |
|---|---|---|
| `--manifest <path>` | `genpm.json` | Para monorepos de paquetes. |
| `--ref <tag\|sha>` | `t` o `v{v}` | Ref a publicar. |
| `--dist-tag <tag>` | `latest` (`next` si prerelease) | — |
| `--dry-run` | — | Valida local + remoto sin escribir. |

Pasos: `validate` local → árbol Git limpio → `git ls-remote --tags origin <ref>` existe y apunta al mismo SHA que local (`E_REF_NOT_PUSHED` si no) → `POST /v1/publish` → muestra URL, `scan_status` y warnings.

### `genpm yank <name>@<version> --reason "<texto>"` ✅

### `genpm login` · `logout` · `whoami` ✅

Device flow de GitHub (ver [architecture §6.5](architecture.md#65-login-device-flow)). `logout` revoca el token en el registry y lo borra localmente.

---

# Parte B — Servidor MCP (`@genpm-net/mcp`)

## B.1 Identidad y transporte

| Propiedad | Valor |
|---|---|
| Arranque | `genpm mcp serve` (binario nativo, opción por defecto) o `npx -y @genpm-net/mcp` (paquete npm, bin `genpm-mcp`); ambos llaman a `serveStdio()` de `@genpm-net/mcp/serve` |
| Server info | `{ name: "genpm", version: <semver> }` |
| Transporte | stdio (MVP). Streamable HTTP solo-lectura (search/info) en `mcp.genpm.net` ✅ V03-04: Worker del registry (`routes/mcp.ts`), sin estado ni SSE (cada POST responde JSON; GET ⇒ 405), tools como subpeticiones a la API pública con la IP del cliente (mismo rate limit), `client=none` (consultar no es instalar), sin `sg` y con el comando `genpm add` para instalar en local |
| SDK | `@modelcontextprotocol/sdk` (`McpServer`, `registerTool`, `outputSchema` + `structuredContent`) |
| Capabilities | `tools`, `resources`, `prompts`, `logging` |
| Raíz del proyecto | `roots/list` del cliente (primer root `file://`) → `GENPM_CWD` → `process.cwd()`. Se recalcula en `notifications/roots/list_changed`. |
| Presupuesto | Toda respuesta de tool apunta a < 1 500 tokens; listas truncadas con indicación de cómo pedir más. |

## B.2 Instrucciones del servidor (`instructions`)

Texto enviado en `initialize` (se mantiene < 250 tokens):

```
GenPM injects full source modules (code + AI rules + MCP config) into this project from immutable Git commits.
genpm keys: n=name v=version s=summary r=repo t=git-ref c=commit-sha d=install-dir i=repo-subdir x=ai-rules-file l=license k=keywords g=genpm-deps p=npm-deps e=env-vars m=mcp-servers
Workflow: genpm_search → genpm_info → genpm_add {dryRun:true} → show the plan to the user → genpm_add.
Before editing an installed package, read <d>/AGENTS.md. Never edit genpm.lock or .genpm/.
Only set allowMcp:true or installNpmDeps:true after the user explicitly agrees.
Never hardcode env var values; point the user to .env.example.
Errors include a "fix" field: follow it when safe, otherwise ask the user.
```

## B.3 Tools

Todas devuelven `structuredContent` (validado contra `outputSchema`) **y** un bloque `text` compacto equivalente para clientes sin soporte de salida estructurada. Errores: `isError: true` + texto `"<CODE>: <message>\nfix: <fix>"` + `structuredContent: {error:{code,message,fix}}`.

### `genpm_search`

| | |
|---|---|
| Descripción | "Search the GenPM registry for injectable architecture modules (code + AI rules + MCP). Use before installing anything." |
| Annotations | `readOnlyHint: true`, `openWorldHint: true` |

```json
{
  "type": "object",
  "properties": {
    "query":    { "type": "string", "maxLength": 100, "description": "What the user needs, e.g. 'stripe subscriptions'" },
    "keywords": { "type": "array", "items": { "type": "string" }, "maxItems": 5 },
    "hasMcp":   { "type": "boolean" },
    "limit":    { "type": "integer", "minimum": 1, "maximum": 20, "default": 5 }
  },
  "required": ["query"],
  "additionalProperties": false
}
```
Salida estructurada: `{ r: [{n,v,s,k,i,m,vf}], nx }` (compacta, sin patrocinados — ADR-010). Texto:
```
@core/billing@1.2.0 — Stripe subscriptions, portal & webhooks [billing,stripe] mcp verified 890/30d
@acme/payments@0.9.0 — Multi-provider payments (Stripe, MercadoPago) [payments] 140/30d
```

### `genpm_info`

| | |
|---|---|
| Descripción | "Get the resolved manifest, dependencies, env vars, MCP servers and AI rules of a GenPM package, plus whether it is already installed here." |
| Annotations | `readOnlyHint: true`, `openWorldHint: true` |

```json
{
  "type": "object",
  "properties": {
    "name":    { "type": "string", "pattern": "^@[a-z0-9][a-z0-9-]*/[a-z0-9][a-z0-9-]*$" },
    "version": { "type": "string", "description": "Exact version, semver range or dist-tag. Default: latest" },
    "fullRules": { "type": "boolean", "default": false, "description": "Return full AI rules instead of a 1.5 KB excerpt" }
  },
  "required": ["name"],
  "additionalProperties": false
}
```
Salida: `{ manifest: ResolvedManifest, deps: ResolvedManifest[], rules: string, rulesTruncated: boolean, scan: string, installed: null | {v, c, d, drift: number} }`.

### `genpm_add`

| | |
|---|---|
| Descripción | "Inject a GenPM package (and its GenPM dependencies) into the project. ALWAYS call with dryRun:true first and show the plan to the user." |
| Annotations | `readOnlyHint: false`, `destructiveHint: false` (falla ante conflicto en vez de sobrescribir), `idempotentHint: true` (repetir ⇒ `skip`), `openWorldHint: true` |

```json
{
  "type": "object",
  "properties": {
    "name":           { "type": "string", "pattern": "^@[a-z0-9][a-z0-9-]*/[a-z0-9][a-z0-9-]*$" },
    "version":        { "type": "string" },
    "dest":           { "type": "string", "description": "Override install dir (relative path)" },
    "dryRun":         { "type": "boolean", "default": false },
    "allowMcp":       { "type": "boolean", "default": false, "description": "Write MCP server config. Only after explicit user consent." },
    "installNpmDeps": { "type": "boolean", "default": false, "description": "Run the package manager for npm deps. Only after explicit user consent." },
    "planId":         { "type": "string", "description": "id from a previous dryRun; apply fails with E_PLAN_STALE if the project changed" }
  },
  "required": ["name"],
  "additionalProperties": false
}
```
- `dryRun: true` ⇒ `InstallPlan`.
- `dryRun: false` ⇒ `{ plan: InstallPlan, result: ApplyResult, pendingMcp: [...], pendingNpm: "pnpm add …" | null }`.
- No existe `force` en el MCP: sobrescribir código del usuario requiere el CLI (decisión deliberada de seguridad).

Ejemplo de texto de salida (apply):
```
Installed @core/billing@1.2.0 (9f2c4e1) → src/lib/billing; @core/auth@1.2.0 → src/lib/auth. @core/db skipped (1.0.3 satisfies ^1.0.0).
Pending (needs user consent): MCP "stripe" (npx -y @stripe/mcp) · npm: pnpm add stripe@^17.0.0 arctic@^3.0.0
Env to configure: STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET AUTH_SECRET (.env.example updated)
Next: read src/lib/billing/AGENTS.md section "Integración" and wire the module.
```

### `genpm_list`

Annotations `readOnlyHint: true`. Input `{}`. Salida `{ p: [{n,v,c,d,drift:{modified,deleted,added}}] }`.

### `genpm_remove`

| | |
|---|---|
| Annotations | `destructiveHint: true`, `idempotentHint: true` |
| Input | `{ name: string, keepCode?: boolean = false }` |
| Comportamiento | Igual que `genpm remove` **sin** `--force`: si hay drift ⇒ `E_DRIFT` con `fix: "Ask the user; retry with keepCode:true to keep their modified code"`. |

### `genpm_outdated`

`readOnlyHint: true`. Input `{}`. Salida `{ o: [{n, v, latest, kind: 'patch'|'minor'|'major', drift}] }`.

### `genpm_audit`

`readOnlyHint: true`. Input `{}`. Salida igual que `genpm audit --json`. Las `instructions` piden al agente ejecutarla antes de modificar paquetes instalados y avisar al usuario de cualquier hallazgo.

### `genpm_validate`

`readOnlyHint: true`. Input `{ path?: string }` (default raíz). Para autores que crean paquetes con ayuda de su IA. Salida: `ValidationReport { ok, errors[], warnings[], files: number, rulesTokens }`.

### `genpm_diff` y `genpm_update` ✅

- `genpm_diff { name, to? }` (read-only) ⇒ `{ from, to, patch: string (unified, remapeado a d), drift: string[] }`, truncado a ~6 000 tokens con lista de archivos omitidos. **Es la pieza de "actualizaciones asistidas por IA"**: el LLM aplica el parche entendiendo los cambios locales.
- `genpm_update { name, to?, strategy: '3way' | 'ai', dryRun?, allowMcp?, installNpmDeps?, planId? }` — `ai` solo actualiza lock/hashes tras confirmar que el LLM aplicó el parche. El parche va delimitado como contenido de terceros (`<package-diff trust="third-party">`).

## B.4 Resources

| URI | Tipo | Contenido |
|---|---|---|
| `genpm://lock` | `application/json` | `genpm.lock` del proyecto actual |
| `genpm://package/{name}/rules` | `text/markdown` (template) | Reglas de un paquete instalado (`<d>/AGENTS.md`) |
| `genpm://spec/legend` | `text/plain` | Leyenda de claves + reglas de comportamiento ([manifest-spec §7](manifest-spec.md#7-cómo-deben-interpretar-genpmjson--genpmlock-los-llms)) |

## B.5 Prompts

| Nombre | Args | Propósito |
|---|---|---|
| `genpm-find` | `need: string` | Guía el flujo search → info → dryRun → confirmación → add para una necesidad en lenguaje natural. |
| `genpm-integrate` | `name: string` | Tras instalar: lee `<d>/AGENTS.md` sección "Integración" y cablea el módulo en la app (rutas, migraciones, env). |

## B.6 Seguridad del servidor MCP

- Solo escribe dentro de la raíz del proyecto (mismo `safePath` que el CLI).
- `allowMcp` e `installNpmDeps` son `false` por defecto y las `instructions` exigen consentimiento explícito del usuario.
- Sin `force` ni `allowAutorun`. Sin publicación (`publish`/`yank`/`login` solo por CLI: credenciales fuera del alcance de un agente).
- Las reglas de paquetes se devuelven delimitadas como contenido de terceros: `<package-rules source="@core/auth@1.2.0" trust="third-party">…</package-rules>` (security §4.5).
- Todo el texto dirigido al LLM (descripciones, `instructions`, resultados, `fix`) está en inglés; el agente traduce al usuario ([i18n](i18n.md) principio 4).
- Logs vía `notifications/message` (nivel `info` por defecto); nunca escribe en stdout fuera del protocolo.

## B.7 Configuración en clientes

`genpm mcp setup` automatiza todo esto. Por defecto el servidor es el que lleva dentro el binario nativo
(`genpm mcp serve`, ADR-025, sin Node). Cuando `genpm` corre desde npm/npx, `setup` registra `npx -y @genpm-net/mcp` en su
lugar (mismo servidor, mismo código: `@genpm-net/mcp/serve`). Manualmente, con el binario:

**Claude Code**
```bash
claude mcp add genpm -- genpm mcp serve
```
o en el proyecto, `.mcp.json`:
```json
{ "mcpServers": { "genpm": { "command": "genpm", "args": ["mcp", "serve"] } } }
```

**Cursor** — `.cursor/mcp.json` (proyecto) o `~/.cursor/mcp.json` (global):
```json
{ "mcpServers": { "genpm": { "command": "genpm", "args": ["mcp", "serve"] } } }
```

**VS Code (Copilot)** — `.vscode/mcp.json`:
```json
{ "servers": { "genpm": { "type": "stdio", "command": "genpm", "args": ["mcp", "serve"] } } }
```

**Windsurf** — `~/.codeium/windsurf/mcp_config.json`:
```json
{ "mcpServers": { "genpm": { "command": "genpm", "args": ["mcp", "serve"] } } }
```

**Codex CLI** — `~/.codex/config.toml`:
```toml
[mcp_servers.genpm]
command = "genpm"
args = ["mcp", "serve"]
```

> Los formatos de configuración de los clientes cambian con frecuencia: los adaptadores viven aislados en `core/inject/clients/*` y se verifican contra la documentación de cada cliente en el Día 5 del sprint.

## B.8 Pruebas

- **Contrato:** `InMemoryTransport.createLinkedPair()` del SDK + cliente MCP en Vitest: lista de tools, validación de `inputSchema`/`outputSchema`, errores con `fix`.
- **E2E:** proyecto fixture temporal + registry local (`wrangler dev`) + repos fixture en `file://` permitidos solo en modo test.
- **Manual:** `npx @modelcontextprotocol/inspector genpm mcp serve` y sesiones reales en Claude Code y Cursor con el guion "Añade auth y billing a este proyecto".
