# Especificación del Registry Edge API — v1

> Estado: **v1 (MVP)** · Fecha: 2026-10-02
> Runtime: Cloudflare Workers + Hono · Datos: D1 (SQLite) + FTS5 · Eventos: Analytics Engine
> Base URL producción: `https://api.genpm.net` (ADR-015 en [brainstorming](brainstorming.md)) · Seguridad: [security.md](security.md) · Idiomas: [i18n.md](i18n.md)

---

## 1. Convenciones generales

| Aspecto | Regla |
|---|---|
| Versionado | Prefijo de ruta `/v1`. Cambios incompatibles ⇒ `/v2`. Campos nuevos en respuestas no son breaking. |
| Formato | JSON UTF-8. Dos representaciones: **compacta** (claves de 1 carácter, `Accept: application/vnd.genpm+json` o `?fmt=c`) y **larga** (claves descriptivas, default, para la web y humanos). |
| Nombres en rutas | El nombre completo va *sin codificar* en dos segmentos: `/v1/packages/@core/auth`. Hono: `/:scope{@[a-z0-9-]+}/:name`. |
| Autenticación | `Authorization: Bearer gpm_<token>` para escrituras y recursos privados. Web: cookie `__Host-genpm_session` (HttpOnly, Secure, SameSite=Lax). |
| Errores | RFC 9457 `application/problem+json` (§7). |
| Paginación | Cursor opaco: `?limit=20&cursor=<base64url>` → respuesta con `next` (o `null`). `limit` máx. 50. |
| IDs | ULID con prefijo: `acc_`, `org_`(=`acc_` kind org), `reg_`, `scp_`, `pkg_`, `ver_`, `tok_`, `spn_`, `aud_`. |
| Tiempos | Enteros epoch **ms** en BD; ISO-8601 UTC en respuestas largas; epoch segundos en compactas. |
| Request ID | Header `genpm-request-id` en toda respuesta (también dentro del problem+json). |
| CORS | `GET` públicos: `Access-Control-Allow-Origin: *`. Escrituras: solo `https://genpm.net`. |
| Idioma | `Accept-Language` (o `?lang=`) localiza `title`/`detail` de errores y elige el idioma de `summary`; respuesta con `Content-Language` y `Vary: Accept-Language`. Códigos, claves y `type` nunca se traducen ([i18n](i18n.md)). |
| Firma | Toda respuesta que contiene un manifiesto resuelto incluye `genpm-signature: keyid=<id>,sig=<base64url>` (Ed25519 sobre la forma canónica) y el campo `sg` en forma compacta ([security §4.3](security.md#43-firma-de-manifiestos-inv-8)). |
| Tenancy | Header opcional `genpm-registry: <slug>` (default `public`). En producción multi-tenant se deriva del host (`acme.genpm.net`). |

## 2. Caché y rendimiento

| Endpoint | `Cache-Control` | Notas |
|---|---|---|
| `GET /v1/packages/:n/versions/:exact` | `public, max-age=31536000, immutable` | Versiones exactas son inmutables. Si se retira (yank), el cuerpo incluye `yanked` y se purga. |
| `GET /v1/resolve/:n` (rango/dist-tag) | `public, max-age=60, stale-while-revalidate=300` | Purga activa al publicar. |
| `GET /v1/packages/:n` | `public, max-age=60, stale-while-revalidate=300` | Purga al publicar/yank/deprecar. |
| `GET /v1/search` | `public, max-age=30, stale-while-revalidate=300` | Clave de caché = query normalizada (minúsculas, términos ordenados). |
| Respuestas autenticadas o privadas | `private, no-store` | Nunca en caché compartida. |

Implementación: Cache API (`caches.default`) en el Worker con clave canónica + `ETag` = hash del cuerpo (`If-None-Match` → `304`).

## 3. Rate limiting

Binding de **Workers Rate Limiting** (`RL_PUBLIC`, `RL_AUTH`):

| Clase | Límite | Clave |
|---|---|---|
| Lectura anónima | 300 req / 60 s | IP |
| Lectura autenticada | 1 200 req / 60 s | token |
| Publish | 10 / hora | cuenta |
| Auth exchange | 10 / 10 min | IP |

Exceso ⇒ `429` + `Retry-After` + problem `E_RATE_LIMITED`.

## 4. Endpoints

### Resumen

| Método | Ruta | Auth | MVP | Uso principal |
|---|---|---|---|---|
| GET | `/v1/search` | — | ✅ | CLI, MCP, web |
| GET | `/v1/resolve/:scope/:name` | — | ✅ | `genpm add` (camino crítico) |
| GET | `/v1/packages/:scope/:name` | — | ✅ | `genpm info`, página de paquete |
| GET | `/v1/packages/:scope/:name/versions` | — | ✅ | Historial de versiones |
| GET | `/v1/packages/:scope/:name/versions/:version` | — | ✅ | Manifiesto exacto |
| GET | `/v1/packages/:scope/:name/dependents` | — | ✅ | "Usado por" (V02-03): paquetes públicos cuya versión latest declara el paquete en `g`; `?limit≤50&cursor`; `fmt=c` ⇒ `{r:[{n,v,s,range,i,vf}],nx}` |
| GET | `/v1/scopes/:scope` | — | ✅ | Página de publisher |
| GET | `/v1/featured` | — | ✅ | Home web, `genpm search` sin query |
| GET | `/v1/stats` | — | ✅ | Contadores públicos de la home |
| POST | `/v1/publish` | token `publish` | ✅ | `genpm publish` |
| POST | `/v1/packages/:scope/:name/versions/:version/yank` | token `publish` | ✅ | Retirar versión |
| POST | `/v1/packages/:scope/:name/deprecate` | token `publish` | ⏳ | Deprecar paquete |
| POST | `/v1/auth/github/exchange` | — | ✅ | `genpm login` (device flow) |
| GET | `/v1/auth/github/callback` | — | ✅ | Login web (OAuth web flow) |
| GET | `/v1/me` | token/cookie | ✅ | `genpm whoami`, dashboard |
| GET/POST/DELETE | `/v1/tokens` | cookie | ✅ | Gestión de tokens en la web |
| POST | `/v1/reports` | token/cookie | ✅ | Reportar paquete (abuso/malware) |
| POST | `/v1/leads` | — (Turnstile) | ⏳ P1 | Formularios de `/sponsors` y `/enterprise` |
| GET | `/v1/admin/analytics?days=1..90` | token/cookie (staff; resto ⇒ 404) | ✅ | Panel `/admin/analytics` (ADR-027): Analytics Engine (web e instalaciones) + D1 (publicaciones, logins, cuentas). `private, no-store` |
| GET | `/v1/badge/:scope/:name.svg` | — | ✅ | Badge para READMEs |
| GET | `/v1/advisories?p=@core/auth@1.2.0,…` | — | ✅ | `genpm audit`: advisories, versiones retiradas y cuarentenas para una lista de paquetes |
| GET | `/v1/keys` | — | ✅ | Claves públicas de firma vigentes + lista de revocación firmada |
| * | `/v1/admin/*` | rol staff | ⏳ | Cuarentena, featured, patrocinios |

---

### 4.1 `GET /v1/search`

| Query | Tipo | Default | Descripción |
|---|---|---|---|
| `q` | string ≤ 100 | — | Texto libre. Vacío ⇒ ordena por popularidad. |
| `k` | string | — | Filtra por keyword exacta (repetible: `k=auth&k=oauth`). |
| `mcp` | `0`/`1` | — | Solo paquetes con servidores MCP. |
| `scope` | string | — | Filtra por scope (`core`). |
| `sort` | `relevance`/`installs`/`recent` | `relevance` | — |
| `sponsored` | `0`/`1` | `0` | Incluir slot patrocinado aparte (ADR-010). El MCP nunca lo envía. |
| `limit`, `cursor` | | 10 | Paginación. |

**Respuesta compacta** (`?fmt=c`) — la que usan CLI `--json` y MCP:
```json
{"r":[{"n":"@core/auth","v":"1.2.0","s":"Sesiones + OAuth con Drizzle","k":["auth","oauth"],"i":1520,"m":0,"vf":1},
      {"n":"@core/billing","v":"1.2.0","s":"Suscripciones Stripe…","k":["billing","stripe"],"i":890,"m":1,"vf":1}],
 "nx":null}
```
`i` = instalaciones últimos 30 días · `m` = tiene MCP · `vf` = publisher verificado · `nx` = cursor siguiente.

**Respuesta larga** (web):
```json
{
  "results": [{
    "name": "@core/auth", "version": "1.2.0", "summary": "…", "keywords": ["auth","oauth"],
    "installs30d": 1520, "hasMcp": false, "publisher": {"handle":"genpm-net","verified":true},
    "license": "MIT", "updatedAt": "2026-10-01T18:22:00Z", "score": 12.4
  }],
  "sponsored": {"name":"@acme/observability","version":"2.1.0","summary":"…","label":"Sponsored","campaignId":"spn_01J…"},
  "next": null,
  "total": 2
}
```

### 4.2 `GET /v1/resolve/:scope/:name`

Camino crítico de la instalación. Cuenta como evento de instalación (Analytics Engine, `ctx.waitUntil`).

| Query | Default | Descripción |
|---|---|---|
| `range` | `latest` | Rango semver (`^1.2.0`), versión exacta o dist-tag (`latest`, `next`). |
| `deps` | `0` | `1` ⇒ incluye la clausura plana de dependencias `g` resuelta en el servidor. |
| `installed` | — | Lista `n@v` ya instalados en el proyecto (`installed=@core/db@1.0.3`), para que el resolutor los reutilice si satisfacen. |
| `client` | `cli` | `cli`/`mcp`/`none` — solo telemetría. Solo `cli` y `mcp` cuentan como instalación; `none` lo envían `GENPM_TELEMETRY=0`/`DO_NOT_TRACK=1`, `--dry-run`, la vista previa `dryRun` del MCP y la página `.md` de la web (ADR-027). |

Algoritmo de resolución de `deps`:
1. Cola BFS desde la raíz; para cada `g` acumula rangos por nombre.
2. Por nombre, elige la versión más alta no retirada que satisface **todos** los rangos acumulados (los ya instalados tienen prioridad si satisfacen).
3. Si no existe ⇒ `409 E_RANGE_UNSATISFIED` con `conflicts: [{n, ranges:[{from, range}]}]`.
4. Profundidad máx. 5; ciclos permitidos (se deduplica por nombre).

**200 (compacta):**
```json
{"root":{"$":1,"n":"@core/auth","v":"1.2.0","r":"https://github.com/genpm-net/auth","t":"v1.2.0","c":"1b9d…","d":"src/lib/auth","i":".","x":"AGENTS.md","l":"MIT","g":{"@core/db":"^1.0.0"},"p":{"arctic":"^3.0.0"},"e":["AUTH_SECRET"]},
 "deps":[{"$":1,"n":"@core/db","v":"1.0.3","r":"https://github.com/genpm-net/db","t":"v1.0.3","c":"77ac…","d":"src/lib/db","i":".","x":"AGENTS.md","l":"MIT","p":{"drizzle-orm":"^0.44.0"},"e":["DATABASE_URL"]}],
 "w":[{"code":"W_DEPRECATED","n":"@core/db","msg":"use @core/db@2"}],
 "scan":{"@core/auth":"passed","@core/db":"passed"}}
```
Errores: `404 E_NOT_FOUND`, `404 E_NO_MATCHING_VERSION`, `409 E_RANGE_UNSATISFIED`, `451 E_QUARANTINED` (paquete en revisión de seguridad).

### 4.3 `GET /v1/packages/:scope/:name`

Respuesta larga (la compacta omite `readme`):
```json
{
  "id": "pkg_01JA…", "name": "@core/auth", "summary": "…", "visibility": "public",
  "repo": "https://github.com/genpm-net/auth", "homepage": null, "license": "MIT",
  "keywords": ["auth","oauth"], "category": "auth",
  "publisher": {"handle":"genpm-net","kind":"org","verified":true,"avatarUrl":"…"},
  "distTags": {"latest":"1.2.0","next":"2.0.0-beta.1"},
  "latest": { "...": "manifiesto resuelto en forma larga" },
  "flags": {"featured": true, "sponsored": false, "deprecated": false, "deprecationMessage": null},
  "stats": {"installs30d": 1520, "installsTotal": 4210, "weekly": [120,180,…]},
  "security": {"scanStatus": "passed", "scannedAt": "2026-10-01T18:22:05Z", "findings": []},
  "contextPreview": "# @core/auth — reglas para agentes\n…(primeros 2 KB de x)",
  "createdAt": "…", "updatedAt": "…"
}
```
`contextPreview` se obtiene de GitHub al publicar y se guarda en `package_versions.context_excerpt` (transparencia: el usuario ve qué le dirán a su IA antes de instalar).

### 4.4 `GET /v1/packages/:scope/:name/versions[/:version]`

Lista: `[{v, t, c, publishedAt, yanked, yankReason, scanStatus}]` ordenada por semver descendente (paginada).
Exacta: manifiesto resuelto (+ `yanked`, `publishedBy`, `publishedAt`).

### 4.5 `POST /v1/publish`

Request:
```json
{ "name": "@core/auth", "version": "1.2.0", "repo": "https://github.com/genpm-net/auth", "ref": "v1.2.0", "manifestPath": "genpm.json", "distTag": "latest" }
```
Validación servidor (en orden; cualquier fallo aborta sin escribir):

| # | Paso | Error |
|---|---|---|
| 1 | Token válido con scope `publish`, no revocado ni expirado | `401 E_AUTH` |
| 2 | Scope existe y la cuenta tiene rol `owner/admin/publisher` en su dueño; o scope libre y `== login GitHub` de la cuenta o de una org de la que es miembro ⇒ auto-claim | `403 E_FORBIDDEN_SCOPE` |
| 3 | `repo` es `https://github.com/<scopes.git_owner>/<repo>` | `422 E_REPO_NOT_ALLOWED` |
| 4 | `ref` existe como tag (`GET /repos/{o}/{r}/git/ref/tags/{ref}`) o es SHA de 40 hex existente | `422 E_REF_MUTABLE` / `E_REF_NOT_FOUND` |
| 5 | Resolver `ref` → `c` (`GET /repos/{o}/{r}/commits/{ref}`); guardar `git_repo_id` (`GET /repos/{o}/{r}` → `id`) y rechazar si cambió respecto a versiones previas | `422 E_REPO_CHANGED` |
| 6 | Leer `manifestPath` @ `c` (raw), validar zod, `n == name`, `v == version` | `422 E_MANIFEST_INVALID` / `E_NAME_MISMATCH` |
| 7 | `(registry, n, v)` no existe (incluye versiones retiradas) | `409 E_VERSION_EXISTS` |
| 8 | Leer `x` @ `c`: existe, ≤ 16 KB; árbol del commit: superficies de auto-ejecución, Trojan Source, secretos, colisiones de ruta; encolar escaneo profundo (security §3.1) | `422 E_CONTEXT_*` / `E_SCAN_FAILED` |
| 9 | Licencia GitHub (`GET /repos/{o}/{r}/license`) | aviso `W_LICENSE_MISMATCH` |
| 10 | Typosquatting: distancia Levenshtein ≤ 1 con un paquete top-100 de otro scope | `scan_status='flagged'` (no bloquea, cuarentena) |
| 11 | Firmar el manifiesto resuelto canónico (Ed25519, clave `active`). `D1.batch([...])` atómico: upsert `packages`, insert `package_versions`, `package_keywords`, `package_dependencies`, update `dist_tags` (si `distTag` y es mayor que el actual o no hay), refresh FTS, `audit_log` | `500 E_INTERNAL` |
| 12 | Purga de caché del paquete | — |

GitHub se consulta con un token de instalación de la **GitHub App de GenPM** (secretos `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`); para repos públicos no requiere instalación del autor.

**201:**
```json
{"manifest":{"$":1,"n":"@core/auth","v":"1.2.0","…":"…"},"scan":{"status":"passed","findings":[]},"warnings":[],"url":"https://genpm.net/p/@core/auth"}
```
Si `scan.status = flagged` ⇒ la versión se crea con `status='quarantined'`, no se vuelve `latest` y `resolve` devuelve `451` hasta revisión.

### 4.6 `POST /v1/packages/:scope/:name/versions/:version/yank`

Body `{ "reason": "CVE-2026-1234 en session.ts" }` (obligatorio, ≤ 280). Efecto: `yanked_at`, `yank_reason`; si era `latest`, `latest` pasa a la siguiente versión estable no retirada. La versión **no** se puede re-publicar. `resolve` con rango la ignora; con versión exacta la sirve con aviso `W_YANKED`.

### 4.7 `POST /v1/auth/github/exchange`

Request `{ "githubToken": "gho_…" }` (obtenido por el CLI con device flow).
1. `GET https://api.github.com/user` → `id`, `login`, `avatar_url`, `email`.
2. `GET https://api.github.com/user/orgs` → orgs (requiere `read:org`).
3. Upsert `accounts` (por `github_id`, **no** por login: los logins cambian), upsert orgs como `accounts(kind='org')`, `memberships(source='github', role='member', synced_at)`.
4. Crear `api_tokens` con `scopes=["read","publish"]`, `expires_at = now + 90 días`, `name = "cli@<hostname>"`.
5. **No** se persiste el token de GitHub.

**200** `{ "token": "gpm_…", "expiresAt": "…", "account": {"handle":"yohangel","orgs":["genpm-net"]} }` (el token en claro solo se devuelve aquí, una vez).

### 4.8 Tokens

Formato: `gpm_` + 32 bytes aleatorios en base62 + checksum CRC32 de 6 caracteres (permite a escáneres de secretos — p. ej. GitHub secret scanning — validar el formato sin consultar el API).
Almacenamiento: `token_hash = HMAC-SHA256(TOKEN_PEPPER, token)`; `token_prefix` = primeros 8 caracteres para mostrar en la UI.

### 4.9 `GET /v1/badge/:scope/:name.svg`

SVG estilo shields: `genpm | v1.2.0` (o `installs | 1.5k/mo` con `?type=installs`). Caché 1 h. Colores de [branding](branding.md).

## 5. Modelo de datos (D1)

### 5.1 Diagrama entidad-relación (texto)

```
registries 1──* scopes 1──* packages 1──* package_versions
     │                         │  │            │  └──* package_dependencies
     │                         │  │            └──* (dist_tags apunta aquí)
     │                         │  ├──* package_keywords
     │                         │  ├──* sponsorships *──1 accounts (sponsor)
     │                         │  └──* install_stats_daily
accounts (user|org) 1──* memberships *──1 accounts
accounts 1──* api_tokens · sessions · audit_log (actor)
packages_fts (FTS5, derivada de packages + keywords)
[futuro, aditivo] teams · team_members · package_grants · registry_members · sso_connections
```

### 5.2 Principios del esquema (por qué no habrá migraciones destructivas)

1. **PK `TEXT` ULID con prefijo** → globales entre bases de datos (tenancy dedicada = copiar filas).
2. **`registry_id` en toda tabla de dominio** y **unicidad compuesta** `(registry_id, …)` desde el día 1. En SQLite cambiar un `UNIQUE` exige reconstruir la tabla; añadir columnas con default no.
3. **Propiedad polimórfica vía `accounts`** (`kind='user'|'org'`): `owner_id` sirve igual para un individuo hoy y para una empresa mañana.
4. **`visibility` enumerada** (`public`/`internal`/`private`) en lugar de un booleano `is_public`: el booleano no puede expresar "visible para miembros de la org" (internal) vs "solo con grant explícito" (private), y cambiarlo después sí sería destructivo.
5. **Flags de monetización desnormalizados** (`is_featured`, `featured_rank`, `is_sponsored`) para lecturas O(1) en el listado + tabla `sponsorships` como fuente de verdad temporal.
6. Fechas en epoch ms `INTEGER`; booleanos `INTEGER CHECK (x IN (0,1))`; JSON en `TEXT CHECK (json_valid(x))`.

### 5.3 DDL — `migrations/0001_init.sql`

```sql
PRAGMA foreign_keys = ON;

-- ───────────── Identidad ─────────────
CREATE TABLE accounts (
  id             TEXT PRIMARY KEY,                         -- acc_<ulid>
  kind           TEXT NOT NULL CHECK (kind IN ('user','org')),
  handle         TEXT NOT NULL COLLATE NOCASE UNIQUE,      -- 'yohangel', 'genpm'
  display_name   TEXT,
  avatar_url     TEXT,
  email          TEXT,                                     -- solo users; nunca se expone públicamente
  github_id      INTEGER UNIQUE,                           -- id numérico estable de GitHub
  github_login   TEXT,
  locale         TEXT,                                     -- BCP 47 preferido (emails, web logueada); NULL = negociar
  has_2fa        INTEGER NOT NULL DEFAULT 0 CHECK (has_2fa IN (0,1)), -- comprobado vía GitHub (requisito de verificación)
  is_verified    INTEGER NOT NULL DEFAULT 0 CHECK (is_verified IN (0,1)),
  is_staff       INTEGER NOT NULL DEFAULT 0 CHECK (is_staff IN (0,1)),
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','deleted')),
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);

CREATE TABLE memberships (
  org_id     TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('owner','admin','publisher','member','reader')),
  source     TEXT NOT NULL DEFAULT 'github' CHECK (source IN ('github','manual','sso','scim')),
  synced_at  INTEGER,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (org_id, user_id)
);
CREATE INDEX idx_memberships_user ON memberships(user_id);

-- ───────────── Tenancy ─────────────
CREATE TABLE registries (
  id               TEXT PRIMARY KEY,                       -- 'reg_public' para el registro público
  slug             TEXT NOT NULL UNIQUE,                   -- 'public', 'acme'
  owner_id         TEXT REFERENCES accounts(id),           -- NULL para el público
  plan             TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','team','enterprise')),
  is_public        INTEGER NOT NULL DEFAULT 1 CHECK (is_public IN (0,1)),
  isolation        TEXT NOT NULL DEFAULT 'shared' CHECK (isolation IN ('shared','dedicated')),
  custom_domain    TEXT UNIQUE,
  settings         TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(settings)),
  created_at       INTEGER NOT NULL
);

CREATE TABLE scopes (
  id           TEXT PRIMARY KEY,                           -- scp_<ulid>
  registry_id  TEXT NOT NULL REFERENCES registries(id),
  name         TEXT NOT NULL COLLATE NOCASE,               -- 'core' (sin '@')
  owner_id     TEXT NOT NULL REFERENCES accounts(id),
  git_host     TEXT NOT NULL DEFAULT 'github.com',
  git_owner    TEXT NOT NULL COLLATE NOCASE,               -- owner de repos permitido (ADR-006)
  is_reserved  INTEGER NOT NULL DEFAULT 0 CHECK (is_reserved IN (0,1)),
  created_at   INTEGER NOT NULL,
  UNIQUE (registry_id, name)
);

-- ───────────── Paquetes ─────────────
CREATE TABLE packages (
  id                 TEXT PRIMARY KEY,                     -- pkg_<ulid>
  registry_id        TEXT NOT NULL REFERENCES registries(id),
  scope_id           TEXT NOT NULL REFERENCES scopes(id),
  name               TEXT NOT NULL COLLATE NOCASE,         -- 'auth'
  full_name          TEXT NOT NULL COLLATE NOCASE,         -- '@core/auth'
  owner_id           TEXT NOT NULL REFERENCES accounts(id),-- user u org (RBAC futuro se apoya aquí)
  created_by         TEXT NOT NULL REFERENCES accounts(id),
  visibility         TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','internal','private')),
  summary            TEXT,
  repo_url           TEXT NOT NULL,
  git_repo_id        INTEGER,                              -- id numérico de GitHub: detecta repojacking (security §3.3)
  homepage           TEXT,
  license            TEXT,
  category           TEXT,                                 -- lista curada: auth, db, billing, email, ai, ui, infra…
  latest_version_id  TEXT,                                 -- FK lógica a package_versions (evita ciclo en DDL)
  latest_version     TEXT,
  has_mcp            INTEGER NOT NULL DEFAULT 0 CHECK (has_mcp IN (0,1)),
  -- Monetización
  is_featured        INTEGER NOT NULL DEFAULT 0 CHECK (is_featured IN (0,1)),
  featured_rank      INTEGER,                              -- orden en la home (menor = antes)
  is_sponsored       INTEGER NOT NULL DEFAULT 0 CHECK (is_sponsored IN (0,1)), -- derivado de sponsorships activos (cron)
  -- Ciclo de vida
  status             TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','quarantined','removed')),
  is_deprecated      INTEGER NOT NULL DEFAULT 0 CHECK (is_deprecated IN (0,1)),
  deprecation_msg    TEXT,
  -- Métricas desnormalizadas (cron)
  installs_total     INTEGER NOT NULL DEFAULT 0,
  installs_30d       INTEGER NOT NULL DEFAULT 0,
  popularity_score   REAL    NOT NULL DEFAULT 0,           -- precalculado: ln(1+installs_30d)/10 + verificado + recencia + quality_score/500
  -- quality_score INTEGER 0–100 y quality TEXT (JSON [[id, 0|1]]) llegan en la migración 0005 (V02-04, @genpm/manifest quality.ts)
  created_at         INTEGER NOT NULL,
  updated_at         INTEGER NOT NULL,
  UNIQUE (registry_id, full_name),
  UNIQUE (scope_id, name)
);
CREATE INDEX idx_packages_registry_vis ON packages(registry_id, visibility, status);
CREATE INDEX idx_packages_owner ON packages(owner_id);
CREATE INDEX idx_packages_featured ON packages(registry_id, is_featured, featured_rank) WHERE is_featured = 1;
CREATE INDEX idx_packages_popular ON packages(registry_id, installs_30d DESC);

CREATE TABLE package_versions (
  id               TEXT PRIMARY KEY,                       -- ver_<ulid>
  package_id       TEXT NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  version          TEXT NOT NULL,
  v_major          INTEGER NOT NULL,
  v_minor          INTEGER NOT NULL,
  v_patch          INTEGER NOT NULL,
  v_prerelease     TEXT,                                   -- NULL = estable (ordena después de prereleases)
  git_ref          TEXT NOT NULL,                          -- t
  commit_sha       TEXT NOT NULL CHECK (length(commit_sha) IN (40,64)), -- c
  dest             TEXT NOT NULL,                          -- d
  include_path     TEXT NOT NULL DEFAULT '.',              -- i
  context_path     TEXT NOT NULL DEFAULT 'AGENTS.md',      -- x
  context_excerpt  TEXT,                                   -- primeros 2 KB de x (preview web)
  manifest         TEXT NOT NULL CHECK (json_valid(manifest)), -- resuelto canónico (§8 manifest-spec)
  manifest_hash    TEXT NOT NULL,
  has_mcp          INTEGER NOT NULL DEFAULT 0 CHECK (has_mcp IN (0,1)),
  scan_status      TEXT NOT NULL DEFAULT 'pending' CHECK (scan_status IN ('pending','passed','flagged','failed')),
  scan_report      TEXT CHECK (scan_report IS NULL OR json_valid(scan_report)),
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','quarantined')),
  published_by     TEXT NOT NULL REFERENCES accounts(id),
  published_at     INTEGER NOT NULL,
  yanked_at        INTEGER,
  yank_reason      TEXT,
  UNIQUE (package_id, version)
);
CREATE INDEX idx_versions_semver ON package_versions(package_id, v_major DESC, v_minor DESC, v_patch DESC);
CREATE INDEX idx_versions_commit ON package_versions(commit_sha);

CREATE TABLE dist_tags (
  package_id  TEXT NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  tag         TEXT NOT NULL CHECK (tag GLOB '[a-z]*'),     -- 'latest', 'next', 'beta'
  version_id  TEXT NOT NULL REFERENCES package_versions(id),
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (package_id, tag)
);

CREATE TABLE package_keywords (
  package_id  TEXT NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  keyword     TEXT NOT NULL,
  PRIMARY KEY (package_id, keyword)
);
CREATE INDEX idx_keywords_kw ON package_keywords(keyword);

CREATE TABLE package_dependencies (
  version_id   TEXT NOT NULL REFERENCES package_versions(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('genpm','npm')),
  dep_name     TEXT NOT NULL,
  dep_range    TEXT NOT NULL,
  PRIMARY KEY (version_id, kind, dep_name)
);
CREATE INDEX idx_deps_reverse ON package_dependencies(kind, dep_name);   -- "usado por"

-- ───────────── Búsqueda ─────────────
CREATE VIRTUAL TABLE packages_fts USING fts5(
  package_id UNINDEXED,
  full_name,
  summary,
  keywords,
  tokenize = 'unicode61 remove_diacritics 2',
  prefix = '2 3'
);
-- `summary` concatena todos los idiomas de `s`.
-- Mantenida por la aplicación dentro del batch de publish (DELETE + INSERT por package_id).

CREATE VIRTUAL TABLE packages_fts_cjk USING fts5(        -- consultas con chino/japonés/coreano (i18n §4.6)
  package_id UNINDEXED,
  full_name,
  summary,
  tokenize = 'trigram'
);
-- Derivada: si se corrompe o en export, se reconstruye desde packages + package_keywords.

-- ───────────── Monetización ─────────────
CREATE TABLE sponsorships (
  id                  TEXT PRIMARY KEY,                    -- spn_<ulid>
  registry_id         TEXT NOT NULL REFERENCES registries(id),
  package_id          TEXT NOT NULL REFERENCES packages(id),
  sponsor_account_id  TEXT NOT NULL REFERENCES accounts(id),
  placement           TEXT NOT NULL CHECK (placement IN ('home_featured','search_slot','category_slot','newsletter')),
  target              TEXT,                                -- keyword o categoría para search/category
  starts_at           INTEGER NOT NULL,
  ends_at             INTEGER NOT NULL,
  status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','ended','cancelled')),
  amount_cents        INTEGER,
  currency            TEXT DEFAULT 'USD',
  external_ref        TEXT,                                -- id de Stripe
  impressions         INTEGER NOT NULL DEFAULT 0,
  clicks              INTEGER NOT NULL DEFAULT 0,
  created_at          INTEGER NOT NULL,
  CHECK (ends_at > starts_at)
);
CREATE INDEX idx_sponsorships_active ON sponsorships(registry_id, placement, status, starts_at, ends_at);

-- ───────────── Auth ─────────────
CREATE TABLE api_tokens (
  id            TEXT PRIMARY KEY,                          -- tok_<ulid>
  account_id    TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  registry_id   TEXT REFERENCES registries(id),            -- NULL = válido en todos donde la cuenta tenga acceso
  org_id        TEXT REFERENCES accounts(id),              -- NULL = personal; si no, restringido a esa org (SaaS)
  name          TEXT NOT NULL,
  token_prefix  TEXT NOT NULL,
  token_hash    TEXT NOT NULL UNIQUE,
  scopes        TEXT NOT NULL DEFAULT '["read"]' CHECK (json_valid(scopes)),  -- read | publish | admin
  allowed_packages TEXT CHECK (allowed_packages IS NULL OR json_valid(allowed_packages)), -- tokens granulares (CI)
  expires_at    INTEGER,
  last_used_at  INTEGER,
  revoked_at    INTEGER,
  created_at    INTEGER NOT NULL
);
CREATE INDEX idx_tokens_account ON api_tokens(account_id);

CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,                            -- hash del id de cookie
  account_id  TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL,
  ip_hash     TEXT,
  user_agent  TEXT,
  created_at  INTEGER NOT NULL
);

-- ───────────── Operación ─────────────
CREATE TABLE install_stats_daily (
  package_id  TEXT NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  day         TEXT NOT NULL,                               -- 'YYYY-MM-DD' UTC
  installs    INTEGER NOT NULL DEFAULT 0,
  via_mcp     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (package_id, day)
);

CREATE TABLE reports (
  id            TEXT PRIMARY KEY,
  package_id    TEXT NOT NULL REFERENCES packages(id),
  version_id    TEXT REFERENCES package_versions(id),
  reporter_id   TEXT REFERENCES accounts(id),
  reason        TEXT NOT NULL CHECK (reason IN ('malware','prompt_injection','spam','typosquat','license','other')),
  details       TEXT,
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','triaged','actioned','dismissed')),
  created_at    INTEGER NOT NULL
);

CREATE TABLE advisories (
  id              TEXT PRIMARY KEY,                        -- adv_<ulid> / GENPM-2026-0001 como alias público
  public_id       TEXT NOT NULL UNIQUE,
  package_id      TEXT NOT NULL REFERENCES packages(id),
  affected_range  TEXT NOT NULL,                           -- rango semver
  patched_version TEXT,
  severity        TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  cve             TEXT,
  title           TEXT NOT NULL CHECK (json_valid(title)),   -- {"en":"…","es":"…"}
  description     TEXT NOT NULL CHECK (json_valid(description)),
  published_at    INTEGER NOT NULL,
  withdrawn_at    INTEGER
);
CREATE INDEX idx_advisories_package ON advisories(package_id);

CREATE TABLE signing_keys (
  id          TEXT PRIMARY KEY,                            -- keyid ('k1', 'k2'…)
  public_key  TEXT NOT NULL,                               -- Ed25519, base64url
  status      TEXT NOT NULL CHECK (status IN ('active','next','retired','revoked')),
  created_at  INTEGER NOT NULL,
  revoked_at  INTEGER
);

CREATE TABLE leads (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL CHECK (kind IN ('sponsor','enterprise')),
  email       TEXT NOT NULL,
  company     TEXT,
  details     TEXT CHECK (details IS NULL OR json_valid(details)),
  status      TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','won','lost')),
  created_at  INTEGER NOT NULL
);

CREATE TABLE audit_log (
  id           TEXT PRIMARY KEY,                           -- aud_<ulid> (ordenable por tiempo)
  registry_id  TEXT NOT NULL,
  actor_id     TEXT,                                       -- NULL = sistema/cron
  action       TEXT NOT NULL,                              -- 'package.publish', 'version.yank', 'token.create'…
  target_type  TEXT NOT NULL,
  target_id    TEXT NOT NULL,
  ip_hash      TEXT,
  metadata     TEXT CHECK (metadata IS NULL OR json_valid(metadata)),
  created_at   INTEGER NOT NULL
);
CREATE INDEX idx_audit_target ON audit_log(target_type, target_id);
CREATE INDEX idx_audit_registry_time ON audit_log(registry_id, created_at);

-- Seed obligatorio
INSERT INTO registries (id, slug, owner_id, plan, is_public, isolation, created_at)
VALUES ('reg_public', 'public', NULL, 'free', 1, 'shared', unixepoch() * 1000);

-- Cuenta de sistema dueña de los scopes oficiales y reservados (sin github_id: nadie puede iniciar sesión como ella)
INSERT INTO accounts (id, kind, handle, display_name, is_verified, is_staff, status, created_at, updated_at)
VALUES ('acc_system', 'org', 'genpm-system', 'GenPM', 1, 1, 'active', unixepoch() * 1000, unixepoch() * 1000);

-- Scopes reservados (security §3.2). `core` publica desde la org genpm-net; el resto queda bloqueado.
-- Sin estas filas, ADR-006 permitiría al dueño de la cuenta `genpm` de GitHub reclamar `@genpm`.
INSERT INTO scopes (id, registry_id, name, owner_id, git_host, git_owner, is_reserved, created_at) VALUES
  ('scp_core',     'reg_public', 'core',     'acc_system', 'github.com', 'genpm-net', 1, unixepoch() * 1000),
  ('scp_genpm',    'reg_public', 'genpm',    'acc_system', 'github.com', 'genpm-net', 1, unixepoch() * 1000),
  ('scp_genpm_net','reg_public', 'genpm-net', 'acc_system', 'github.com', 'genpm-net', 1, unixepoch() * 1000),
  ('scp_official', 'reg_public', 'official', 'acc_system', 'github.com', 'genpm-net', 1, unixepoch() * 1000),
  ('scp_admin',    'reg_public', 'admin',    'acc_system', 'github.com', 'genpm-net', 1, unixepoch() * 1000),
  ('scp_security', 'reg_public', 'security', 'acc_system', 'github.com', 'genpm-net', 1, unixepoch() * 1000),
  ('scp_registry', 'reg_public', 'registry', 'acc_system', 'github.com', 'genpm-net', 1, unixepoch() * 1000),
  ('scp_npm',      'reg_public', 'npm',      'acc_system', 'github.com', 'genpm-net', 1, unixepoch() * 1000),
  ('scp_github',   'reg_public', 'github',   'acc_system', 'github.com', 'genpm-net', 1, unixepoch() * 1000);
-- Las marcas (top 500 empresas tech) van en migraciones de datos posteriores (0002_reserved_brands.sql).
-- Regla de publish: is_reserved = 1 ⇒ solo cuentas con rol en acc_system (staff) pueden publicar o transferir el scope.
```

### 5.4 Migración futura `000N_rbac.sql` (puramente aditiva — referencia, NO en el MVP)

```sql
CREATE TABLE teams (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  slug TEXT NOT NULL, name TEXT NOT NULL, created_at INTEGER NOT NULL, UNIQUE (org_id, slug)
);
CREATE TABLE team_members (
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('maintainer','member')), PRIMARY KEY (team_id, user_id)
);
CREATE TABLE package_grants (
  package_id TEXT NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  principal_type TEXT NOT NULL CHECK (principal_type IN ('user','team')),
  principal_id TEXT NOT NULL,
  permission TEXT NOT NULL CHECK (permission IN ('read','write','admin')),
  PRIMARY KEY (package_id, principal_type, principal_id)
);
CREATE TABLE registry_members (
  registry_id TEXT NOT NULL REFERENCES registries(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,  -- user u org completa
  role TEXT NOT NULL CHECK (role IN ('admin','publisher','reader')),
  PRIMARY KEY (registry_id, account_id)
);
CREATE TABLE sso_connections (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES accounts(id),
  protocol TEXT NOT NULL CHECK (protocol IN ('saml','oidc')), config TEXT NOT NULL CHECK (json_valid(config)),
  created_at INTEGER NOT NULL
);
```
Ninguna tabla existente cambia. La regla de lectura pasa a ser:

```
puede_leer(pkg, user) =
     pkg.visibility = 'public'
  OR (pkg.visibility = 'internal' AND user ∈ miembros(pkg.owner_id) ∪ registry_members(pkg.registry_id))
  OR (pkg.visibility = 'private'  AND (user ∈ admins(pkg.owner_id) OR grant(pkg, user|team(user)) ≥ 'read'))
```
En el MVP el middleware ya aplica `visibility = 'public'` en todas las consultas públicas — un único punto de extensión.

## 6. Consultas de referencia

**Búsqueda con ranking:**
```sql
SELECT p.full_name, p.latest_version, p.summary, p.installs_30d, p.has_mcp, a.is_verified,
       bm25(packages_fts, 0.0, 10.0, 2.0, 4.0) AS rel        -- pesos: id, nombre, resumen, keywords
FROM packages_fts f
JOIN packages p ON p.id = f.package_id
JOIN accounts a ON a.id = p.owner_id
WHERE packages_fts MATCH ?1                                  -- términos escapados: "auth"* "github"*
  AND p.registry_id = ?2 AND p.visibility = 'public' AND p.status = 'active'
ORDER BY rel * (1.0 + p.popularity_score) ASC               -- bm25 es negativo: más negativo = mejor
LIMIT ?3;
```
Escapado: cada término del usuario se envuelve en comillas dobles (duplicando las internas) y se añade `*` para prefijo; se descartan operadores FTS (`AND`, `NEAR`, `:`), máx. 8 términos.

**Resolución de rango:** se cargan las versiones activas no retiradas del paquete (normalmente < 100 filas, índice `idx_versions_semver`) y se resuelve con `semver.maxSatisfying` en el Worker. No se intenta resolver semver en SQL.

**Slot patrocinado:**
```sql
SELECT p.full_name, p.latest_version, p.summary, s.id AS campaign_id
FROM sponsorships s JOIN packages p ON p.id = s.package_id
WHERE s.registry_id = ?1 AND s.placement = 'search_slot' AND s.status = 'active'
  AND ?2 BETWEEN s.starts_at AND s.ends_at
  AND (s.target IS NULL OR s.target IN (SELECT value FROM json_each(?3)))   -- keywords de la query
  AND p.status = 'active'
ORDER BY random() LIMIT 1;
```

## 7. Errores (RFC 9457)

```json
{
  "type": "https://genpm.net/errors/E_RANGE_UNSATISFIED",
  "title": "No version satisfies all ranges",
  "status": 409,
  "code": "E_RANGE_UNSATISFIED",
  "detail": "@core/db: ^1.0.0 (from @core/auth) conflicts with ^2.0.0 (from @core/billing)",
  "requestId": "01JA…",
  "conflicts": [{"n":"@core/db","ranges":[{"from":"@core/auth","range":"^1.0.0"},{"from":"@core/billing","range":"^2.0.0"}]}]
}
```

| HTTP | Código | Significado |
|---|---|---|
| 400 | `E_BAD_REQUEST` | Parámetros inválidos |
| 401 | `E_AUTH` | Falta token, inválido, expirado o revocado |
| 403 | `E_FORBIDDEN_SCOPE` | Sin permiso sobre el scope/paquete |
| 404 | `E_NOT_FOUND` / `E_NO_MATCHING_VERSION` | Paquete o versión inexistente (privado sin acceso ⇒ también 404, no 403) |
| 409 | `E_VERSION_EXISTS` / `E_RANGE_UNSATISFIED` | Conflictos |
| 422 | `E_MANIFEST_INVALID` `E_NAME_MISMATCH` `E_REF_MUTABLE` `E_REF_NOT_FOUND` `E_REPO_NOT_ALLOWED` `E_CONTEXT_MISSING` `E_CONTEXT_TOO_LARGE` `E_PATH_UNSAFE` | Validación de publicación |
| 429 | `E_RATE_LIMITED` | Rate limit |
| 451 | `E_QUARANTINED` | Versión/paquete en revisión de seguridad |
| 502 | `E_UPSTREAM_GIT` | GitHub no respondió / repo inaccesible |
| 503 | `E_READ_ONLY` | Registry en modo solo lectura por un incidente (`READ_ONLY=1`, runbook §3): se puede leer e instalar, no escribir |
| 500 | `E_INTERNAL` | Error inesperado (con `requestId`) |

El catálogo vive en `@genpm/manifest/errors` y lo reutilizan CLI y MCP (mismo `code`, distinto envoltorio).

## 8. Cron Triggers

| Cron | Tarea |
|---|---|
| `0 * * * *` | Rollup Analytics Engine → `install_stats_daily` (últimos 2 días); actualizar `installs_30d`, `installs_total`. Sin `CF_AE_TOKEN` no toca D1 y registra `installs_rollup_skipped` en los logs. |
| `15 3 * * *` | Rollup de los últimos 30 días (recupera huecos; ADR-027); recalcular `quality_score` (V02-04) y `popularity_score`; activar/desactivar `sponsorships` por fecha y sincronizar `packages.is_sponsored`; auditoría de tags (tag→SHA ≠ `commit_sha` ⇒ `audit_log` + alerta); marcar repos inaccesibles. |
| `0 4 * * SUN` | Re-sync de membresías de GitHub con `synced_at` > 7 días (vía GitHub App). |

## 9. Bindings (`wrangler.jsonc`)

```jsonc
{
  "name": "genpm-registry",
  "main": "src/index.ts",
  "compatibility_date": "2026-09-01",
  "compatibility_flags": ["nodejs_compat"],
  "d1_databases": [{ "binding": "DB", "database_name": "genpm-registry", "database_id": "<id>", "migrations_dir": "migrations" }],
  "analytics_engine_datasets": [{ "binding": "INSTALLS", "dataset": "genpm_installs" }],
  "ratelimits": [
    { "name": "RL_PUBLIC", "namespace_id": "1001", "simple": { "limit": 300, "period": 60 } },
    { "name": "RL_AUTH",   "namespace_id": "1002", "simple": { "limit": 1200, "period": 60 } }
  ],
  "triggers": { "crons": ["0 * * * *", "15 3 * * *", "0 4 * * SUN"] },
  "routes": [{ "pattern": "api.genpm.net", "custom_domain": true }]
  // secretos (wrangler secret put): GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, GITHUB_OAUTH_CLIENT_ID, GITHUB_OAUTH_CLIENT_SECRET, TOKEN_PEPPER
}
```

## 10. Tests de contrato (mínimos para el MVP)

- Publish: rama como `ref` ⇒ 422; versión duplicada ⇒ 409; manifiesto con `n` distinto ⇒ 422; scope ajeno ⇒ 403; éxito ⇒ fila en `package_versions` con `commit_sha` correcto y FTS actualizado.
- Resolve: `^1` elige la mayor 1.x no retirada; prerelease solo si el rango lo pide; conflicto de deps ⇒ 409 con `conflicts`.
- Search: escapado de operadores FTS; `visibility != 'public'` nunca aparece; patrocinado solo con `sponsored=1`.
- Caché: versión exacta devuelve `immutable`; publish purga `/packages` y `/resolve`.
- Mock de GitHub con `fetchMock` de `@cloudflare/vitest-pool-workers`.
