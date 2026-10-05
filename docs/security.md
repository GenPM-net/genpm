# GenPM — Especificación de seguridad

> Estado: **v1 (MVP)** · Fecha: 2026-10-02 · Dueño: Tech Lead (rol de *Security Owner* hasta tener equipo dedicado)
> Este documento es **normativo**: si una implementación viola un invariante de §2, es un bug de severidad crítica y bloquea el release.

---

## 0. Sobre "100 % de seguridad"

Ningún sistema conectado a Internet puede garantizar seguridad absoluta, y prometerlo sería la primera vulnerabilidad: genera
falsa confianza en usuarios y equipo. Lo que GenPM sí hace es más exigente y verificable:

1. **Invariantes garantizados por construcción** (§2): propiedades que el diseño hace imposibles de violar sin un bug, y que tienen un test que bloquea el CI si fallan.
2. **Defensa en profundidad** (§3–§8): cada amenaza conocida tiene al menos dos controles independientes.
3. **Riesgo residual explícito** (§11): lo que **no** podemos garantizar, dicho en voz alta y con mitigación.
4. **Mejora continua y respuesta** (§9–§10): escaneo, auditorías externas, bug bounty y respuesta a incidentes con plazos.

El mensaje público es: *"Seguro por diseño, verificable por cualquiera"*. Nunca "100 % seguro".

## 1. Activos y adversarios

| Activo | Por qué importa |
|---|---|
| Máquina y proyecto del usuario | GenPM escribe archivos en ella |
| Agente IA del usuario | Lee las reglas que GenPM inyecta → puede ser manipulado |
| Integridad de los paquetes | Lo revisado debe ser lo instalado |
| Cuentas y tokens de publishers | Permiten publicar versiones |
| Registry (D1, Workers) | Fuente de verdad de qué SHA instalar |
| Cadena de suministro de GenPM (npm, GitHub Actions) | Comprometerla compromete a todos los usuarios |
| Datos personales (email, IP) | Obligaciones GDPR / LGPD / CCPA |

| Adversario | Capacidad |
|---|---|
| Autor malicioso | Publica paquetes con código o reglas maliciosas |
| Atacante de cuenta | Roba un token o una cuenta de GitHub de un publisher |
| Atacante de red | MITM, DNS, CDN comprometido |
| Atacante del registry | Explota el API (inyección, IDOR, DoS, cross-tenant) |
| Atacante de cadena de suministro | Compromete una dependencia de GenPM o su pipeline de release |
| Insider | Acceso a Cloudflare/GitHub/npm del equipo |

## 2. Invariantes de seguridad (garantías por construcción)

Cada invariante tiene: implementación única (un solo punto en el código), test obligatorio y prueba de regresión en CI.

| ID | Invariante | Cómo se garantiza | Test que lo bloquea |
|---|---|---|---|
| **INV-1 Integridad** | Los bytes inyectados son exactamente los del árbol del commit `c` (filtrado por `i` y `.genpmignore`). Nunca de una rama. | Fetch por SHA + `git rev-parse HEAD === c`; hash SHA-256 por archivo registrado en `.genpm/files`; el registry rechaza refs de rama. | `fetch.integrity.test.ts`: repo fixture con tag movido, SHA falso, servidor que devuelve otro commit |
| **INV-2 Cero ejecución** | GenPM nunca ejecuta código del paquete ni hooks. | Sin lifecycle scripts; git con `-c core.hooksPath=/dev/null -c core.fsmonitor=false -c protocol.ext.allow=never -c protocol.file.allow=never -c submodule.recurse=false -c core.symlinks=false`, `GIT_LFS_SKIP_SMUDGE=1`, `GIT_TERMINAL_PROMPT=0`; sin `shell: true` en ningún `spawn`. | Repo fixture con hooks, submódulos, `.gitattributes` con filtros y LFS: ningún proceso hijo inesperado (spy de `child_process`) |
| **INV-3 Confinamiento** | Solo se escribe dentro de la raíz del proyecto, en los destinos del plan. | `safePath()` único; `lstat` + `realpath` de cada directorio padre (un directorio enlazado del usuario no puede desviar la escritura); rechazo de symlinks y archivos especiales del paquete; staging + `rename`. | Corpus de path traversal (§8.2) + property tests con fast-check |
| **INV-4 Sin ejecutables** | Ningún archivo inyectado queda con permiso de ejecución. | Escritura con modo `0o644`; aviso listando archivos que lo tenían en origen. | Test de permisos en Linux/macOS |
| **INV-5 Consentimiento** | No se escribe config MCP, no se ejecuta el package manager y no se sobrescribe código sin consentimiento explícito. | Flags `allowMcp`/`installNpmDeps`/`force` en `false` por defecto; el MCP no expone `force`; no TTY ⇒ `E_CONFIRM_REQUIRED`. | Tests de CLI no interactivo y de tools MCP |
| **INV-6 Secretos** | GenPM nunca lee valores de `.env*`, nunca envía archivos del proyecto y la telemetría solo incluye `(paquete, versión, cliente, versión del CLI, país)`. | No existe código que lea `.env` (solo escribe nombres en `.env.example`); test de red que intercepta todo el tráfico saliente del CLI. | `telemetry.payload.test.ts` (snapshot del payload exacto) |
| **INV-7 Autoridad del registry** | El registry nunca confía en el manifiesto del cliente; solo publica desde repos del owner del scope. | Publish recibe coordenadas y lee GitHub en el servidor (api-spec §4.5). | Tests de contrato de publish |
| **INV-8 Manifiestos firmados** | El CLI solo instala un manifiesto resuelto con firma válida del registry. | Ed25519 sobre la forma canónica; claves públicas fijadas en el CLI (§4.3). | Test con manifiesto alterado en tránsito ⇒ `E_SIGNATURE` |
| **INV-9 Inmutabilidad** | Una versión `(registry, n, v)` publicada nunca cambia ni se re-publica. | `UNIQUE(package_id, version)` + sin endpoint de update; yank no borra. | Test de contrato |
| **INV-10 Aislamiento de tenants** | Ninguna consulta devuelve filas de otro `registry_id` ni paquetes no visibles. | Capa de datos única que exige `TenantContext` en tipo; consultas crudas prohibidas por lint. | Suite cross-tenant (§8.4) |

## 3. Seguridad del contenido de los paquetes

Las dos superficies nuevas que GenPM introduce frente a npm: **código que el usuario no revisó línea a línea** y **reglas que leerá su agente IA**.

### 3.1 Pipeline de escaneo en publish

Se ejecuta en el registry (Worker + Queue para el análisis pesado) sobre el commit `c`. Resultado: `passed` · `flagged` (cuarentena, revisión humana) · `failed` (rechazo).

| Capa | Qué detecta | Acción por defecto |
|---|---|---|
| **Reglas IA (`x`)** | Frases de override ("ignore previous instructions", "do not tell the user", variantes en los 8 idiomas soportados), instrucciones de exfiltración (URLs externas + "send/post/upload"), comandos `curl … \| sh`, base64/hex largos, **caracteres invisibles** (Unicode Tags U+E0000–E007F, zero-width, bidi), enlaces acortados | `flagged` |
| **Clasificador LLM (2ª opinión)** | Intención maliciosa en reglas, con prompt endurecido y salida estructurada. Es una *señal*, nunca la única barrera (el clasificador también puede ser manipulado) | `flagged` si riesgo ≥ medio |
| **Superficies de auto-ejecución** | Archivos que otras herramientas ejecutan solas al abrir/instalar el proyecto: `package.json` con `preinstall/install/postinstall/prepare`, `.npmrc`, `.yarnrc*`, `bunfig.toml`, `.envrc` (direnv), `.vscode/tasks.json` (`runOn: folderOpen`), `.vscode/settings.json`, `.devcontainer/`, `.husky/`, `lefthook.yml`, `.pre-commit-config.yaml`, `.gitattributes`, `.gitmodules` | `failed` (y el CLI los excluye siempre; `--allow-autorun` solo para paquetes verificados, con aviso rojo) |
| **Trojan Source** | Caracteres bidi y homoglifos en código (CVE-2021-42574) | `failed` |
| **Secretos** | Patrones tipo gitleaks (claves AWS, Stripe live, tokens GitHub, claves privadas) | `failed` (protege al propio autor) |
| **Código sospechoso** | `eval`/`new Function` sobre datos decodificados, ofuscación, llamadas de red a dominios recién registrados o IPs literales, minificado sin fuente, binarios | `flagged` |
| **Colisiones de ruta** | Archivos que difieren solo en mayúsculas o normalización Unicode (NFC/NFD), nombres reservados de Windows (`CON`, `NUL`, `AUX`…), puntos/espacios finales | `failed` |
| **Typosquatting** | Levenshtein ≤ 1 o confusables con paquetes top-100 / scopes reservados | `flagged` |
| **Tamaño** | > 2 000 archivos, > 20 MB, archivo > 1 MB, reglas > 16 KB | `failed` / aviso |

El CLI ejecuta las mismas reglas deterministas localmente (`genpm validate` para autores, y en `add` sobre lo descargado — **doble verificación**: un registry comprometido no basta para saltarse el escaneo cliente).

### 3.2 Revisión humana y confianza

- Cola de cuarentena con SLA: revisión en < 24 h hábiles; `resolve` devuelve `451` mientras tanto.
- Paquetes `@core/*`: revisión obligatoria de dos mantenedores (CODEOWNERS en cada repo) antes de etiquetar.
- Publisher verificado: org con dominio verificado (DNS TXT) + 2FA obligatorio en GitHub (comprobado vía API de la org).
- **Scopes reservados**: `genpm`, `core`, `official`, `admin`, `security`, `registry`, `npm`, `github` y marcas de las 500 principales empresas tech. Importante: el usuario de GitHub `genpm` **existe y no es nuestro** (cuenta vacía creada en 2023); sin la reserva, ADR-006 le permitiría reclamar el scope `@genpm`.

### 3.3 Monitorización continua

| Control | Frecuencia |
|---|---|
| Auditoría tag → SHA (detecta tags movidos tras publicar) | Diaria |
| Detección de *repojacking*: se guarda el `repo_id` numérico de GitHub; si el repo se borra o renombra y otro lo recrea, el paquete pasa a `unavailable` | Diaria |
| Re-escaneo de todas las versiones `latest` cuando se actualizan las reglas del escáner | Por release del escáner |
| Feed de advisories (OSV) para las dependencias npm declaradas en `p` | Diaria |

### 3.4 Advisories y `genpm audit`

Tabla `advisories` (id, paquete, rango afectado, severidad, CVE, descripción localizada, versión corregida). Superficies:
- `genpm audit` (CLI) y `genpm_audit` (MCP, solo lectura): verifica INV-1 en disco (hashes vs `.genpm/files`), firma de cada entrada del lock contra el registry (INV-8), y cruza con advisories, versiones retiradas y cuarentenas. Exit 6 si hay severidad alta o crítica.
- `genpm add`/`outdated`/`list` muestran avisos de advisories automáticamente.
- Página `/security/advisories` en la web + feed RSS/JSON + GitHub Security Advisories en los repos `@core`.

Como la telemetría es anónima, **no sabemos quién instaló una versión vulnerable**: la comunicación es pull (CLI, MCP, web) + canales públicos. Es una decisión de privacidad consciente.

## 4. Cliente (CLI, MCP, core)

### 4.1 Red
- Solo HTTPS con verificación TLS; el CLI rechaza `http://` para el registry salvo `localhost` en modo test.
- Hosts permitidos para fetch directo: los del `r` del manifiesto firmado; nunca se siguen redirecciones a otro host.
- Timeouts (10 s conexión, 60 s fetch) y límites de tamaño de respuesta.

### 4.2 Credenciales
- Token en el llavero del SO (macOS Keychain, Windows Credential Manager, libsecret) con fallback a `~/.genpm/auth.json` `0600`; el CLI se niega a usar el archivo si tiene permisos más abiertos (`E_INSECURE_PERMS`).
- Tokens con expiración (90 días CLI, 30 días por defecto en tokens creados en la web), revocables, con scopes mínimos (`read` vs `publish`) y opcionalmente restringidos a paquetes concretos (CI).
- `GENPM_TOKEN` en CI; recomendación oficial: **trusted publishing** con OIDC de GitHub Actions (✅ V03-01) para eliminar tokens de larga vida: el dueño del scope autoriza `owner/repo` (+ workflow y environment opcionales, con el id numérico del repo contra repojacking) y `POST /v1/auth/oidc/exchange` verifica el JWT RS256 de `token.actions.githubusercontent.com` (aud `genpm`) y emite un token `publish` de 15 min con `allowed_packages = @scope/*` y `repository` fijado. `allowed_packages` se aplica en publish, yank y deprecate.

### 4.3 Firma de manifiestos (INV-8)
- El registry firma cada manifiesto resuelto canónico con **Ed25519** (WebCrypto en Workers; clave privada como secreto, rotación anual).
- Respuesta: `{"…manifiesto…"}` + header `genpm-signature: keyid=<id>,sig=<base64url>`.
- El CLI y el MCP incluyen las claves públicas vigentes y la siguiente (rotación sin romper clientes antiguos); revocación de claves vía lista firmada por una clave raíz offline.
- Se guarda la firma en el lockfile (`sg`) → `genpm audit` puede verificar procedencia offline.
- v1.0: registro de transparencia (Sigstore Rekor) para cada publicación.

### 4.4 Lockfile y repositorio del usuario
- Un PR malicioso que cambie `genpm.lock` no ejecuta nada (no existe `genpm install`). `genpm audit` en CI detecta entradas sin firma válida o hashes que no cuadran.
- Recomendación en docs: añadir `genpm audit` al CI del proyecto (en CI vale `npx @genpm-net/cli audit` o el binario con `install.sh`).

### 4.5 Servidor MCP
- Sin `force`, sin `publish`, sin acceso a credenciales.
- Confinado a la raíz del proyecto que declaran los `roots` del cliente.
- Las reglas de paquetes se entregan al LLM **delimitadas y etiquetadas como contenido de terceros** (`<package-rules source="@core/auth@1.2.0" trust="third-party">…</package-rules>`), y las `instructions` del servidor indican que nunca tienen autoridad para ejecutar acciones fuera del alcance pedido por el usuario.

## 5. Registry y API

| Área | Control |
|---|---|
| Validación | zod en **toda** entrada (params, query, body, headers); límites de tamaño (body ≤ 16 KB) |
| SQL | Solo sentencias preparadas de D1 con `bind()`. Regla de lint que prohíbe template strings en `prepare()`. Consultas FTS con escapado (api-spec §6) |
| AuthN | Tokens `gpm_` con checksum, HMAC-SHA256 con *pepper* en reposo, comparación en tiempo constante; sesiones web en cookies `__Host-` HttpOnly/Secure/SameSite=Lax con rotación al login |
| AuthZ | Comprobación de permisos en un middleware único por recurso (`can(actor, action, resource)`); recursos inaccesibles devuelven `404`, no `403` (no revelar existencia) |
| CSRF | Token sincronizado en formularios web autenticados + verificación de `Origin` |
| CORS | `*` solo en GET públicos sin credenciales; escrituras solo desde `https://genpm.net` |
| SSRF | El Worker solo hace `fetch` a `api.github.com`, `raw.githubusercontent.com` y `codeload.github.com`, con `redirect: "manual"` |
| ReDoS | Todas las regex revisadas como lineales (herramienta `recheck` en CI); límite de longitud previo a cualquier regex |
| DoS | Rate limiting por IP/token (api-spec §3), WAF de Cloudflare, caché agresiva, colas para trabajo pesado |
| Cabeceras | HSTS (preload), `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin`, CSP en la web (web-ui-spec §8) |
| Auditoría | `audit_log` append-only (sin endpoint de update/delete); exportable en planes de pago |
| Secretos | Solo `wrangler secret`; nunca en código ni en `wrangler.jsonc`; staging y producción con secretos y bases de datos distintos |
| Datos personales | Email nunca público; IP solo como hash con sal rotada diariamente; retención de logs 30 días |

## 6. Cadena de suministro de GenPM

Objetivo: **SLSA Build Level 3** para `genpm` y `@genpm-net/mcp`.

| Control | Detalle |
|---|---|
| Publicación npm | Solo desde GitHub Actions con *trusted publishing* (OIDC) + `--provenance`; sin tokens npm de larga vida; 2FA obligatorio en la org `@genpm` |
| Dependencias | Presupuesto: ≤ 10 dependencias de runtime en el CLI; lockfile congelado (`pnpm install --frozen-lockfile`); `onlyBuiltDependencies: []` (ninguna dependencia ejecuta scripts al instalar); Renovate con `minimumReleaseAge: 7 days`; OSV-Scanner + Socket en cada PR |
| CI | Actions fijadas por SHA, `permissions:` mínimos por job, `harden-runner` (egress allowlist), sin `pull_request_target` con checkout de código externo |
| Repo | Protección de `main`, revisión obligatoria (CODEOWNERS), commits y tags firmados, secret scanning con *push protection* |
| Artefactos | SBOM CycloneDX y checksums en cada release; builds reproducibles verificados en CI. Binarios nativos (ADR-025): compilados en GitHub Actions desde el mismo bundle que npm, con `SHA256SUMS` y *attestation* de procedencia (Sigstore, `gh attestation verify`); instaladores y `genpm upgrade` verifican el SHA-256 antes de instalar y nunca piden `sudo` |
| Cuentas del equipo | Llaves hardware (FIDO2) en GitHub, npm, Cloudflare y registrador del dominio; *registrar lock* en `genpm.net`; DNSSEC |
| Accesos | Principio de mínimo privilegio; tokens de API de Cloudflare con alcance por recurso; revisión trimestral de accesos |

## 7. Privacidad y cumplimiento

- Telemetría anónima y desactivable (`DO_NOT_TRACK=1` / `GENPM_TELEMETRY=0`), documentada en todos los idiomas soportados.
- Base legal y textos legales para **GDPR (UE), LGPD (Brasil), CCPA (California)** y leyes de LATAM; la versión en inglés es la vinculante, con traducciones oficiales (ver [i18n](i18n.md)).
- Derecho de supresión: borrado de cuenta ⇒ `accounts.status='deleted'`, datos personales anonimizados; los paquetes publicados permanecen (integridad del ecosistema) transferidos a una cuenta de sistema, salvo orden legal.
- Roadmap: DPA para clientes B2B (v1.0), SOC 2 Type I (v1.0) → Type II (+6 meses), residencia de datos UE para tenants dedicados (verificar opciones de jurisdicción de D1 en su momento).

## 8. Verificación

### 8.1 En cada PR (bloqueante)
- Tests de invariantes INV-1…INV-10.
- SAST: Semgrep (reglas propias + `p/typescript`, `p/nodejs`) y CodeQL.
- Dependencias: OSV-Scanner, Socket.
- Secretos: gitleaks.
- Property-based tests (fast-check) de `safePath`, parser de manifiesto, parser de lockfile, escapado FTS.

### 8.2 Corpus de path traversal (mínimo)
`../x`, `..\\x`, `%2e%2e/x`, `src/../../x`, `/etc/x`, `C:\\x`, `\\\\server\\share`, `~/x`, `src/\u0000x`, `src/CON`, `src/aux.ts`, `src/x.` , `src/x `, `src/a.ts` + `src/A.ts`, NFC/NFD (`é` precompuesta vs combinada), rutas de 300 caracteres, symlink a `/`, symlink a directorio padre, directorio del usuario que es symlink fuera del proyecto, hardlinks.

### 8.3 Antes de cada release
- DAST: OWASP ZAP baseline contra staging.
- Prueba manual de los guiones de ataque del modelo de amenazas (reglas maliciosas, MCP malicioso, auto-ejecución).

### 8.4 Aislamiento multi-tenant
Suite que crea dos registries con datos espejo y verifica que cada endpoint, con cada tipo de credencial, nunca devuelve datos del otro (incluidos búsqueda, conteos, errores y tiempos de respuesta comparables).

### 8.5 Externa
| Hito | Actividad |
|---|---|
| Lanzamiento MVP | Programa de divulgación responsable + `security.txt` + "Public beta" explícito |
| v0.3 | **Auditoría externa** del CLI/core y del registry (firma especializada) |
| v1.0 (SaaS) | Pentest externo completo incluido multi-tenant + bug bounty público con recompensas |
| Anual | Re-auditoría + ejercicio de respuesta a incidentes |

## 9. Respuesta a incidentes

| Severidad | Ejemplo | Contención | Comunicación |
|---|---|---|---|
| **Crítica** | Paquete malicioso publicado; clave de firma comprometida; fuga cross-tenant | ≤ 1 h desde confirmación (cuarentena global, rotación de claves) | Advisory + post en redes + status page ≤ 4 h |
| **Alta** | Bypass de `safePath` en un SO; token de publisher robado | ≤ 24 h | Advisory ≤ 48 h |
| **Media** | Bypass del escáner de reglas | ≤ 7 días | Notas de versión |
| **Baja** | Hardening | Siguiente release | Changelog |

Herramientas de contención: cuarentena de versión/paquete/scope (`451` inmediato tras purga de caché), revocación masiva de tokens de una cuenta, suspensión de cuenta, lista de revocación de claves de firma, modo solo-lectura del registry.
Post-mortem público sin culpables para toda severidad alta o crítica.

**Canal de reporte:** `hello@genpm.net` con asunto `[SECURITY]` (único buzón por ahora, decisión del fundador 2026-10-03; clave PGP publicada; filtro que marca esos correos como prioritarios). Cuando haya equipo, `security@` como alias o buzón propio. Además: GitHub Private Vulnerability Reporting en todos los repos, `https://genpm.net/.well-known/security.txt`. Respuesta inicial ≤ 48 h. Safe harbor para investigadores de buena fe.

## 10. Puertas de seguridad del lanzamiento (Día 6)

- [ ] INV-1…INV-10 con tests verdes en macOS, Linux y Windows.
- [ ] Corpus §8.2 completo y verde.
- [ ] Firma de manifiestos activa y verificada por el CLI publicado.
- [ ] Escáner v1 (deterministas) activo en publish **y** en el cliente.
- [ ] Las 5 semillas con escaneo `passed` y revisión de dos personas (o, mientras el fundador trabaje solo, la revisión de ADR-023).
- [ ] npm publicado con provenance desde CI; 2FA/FIDO2 en todas las cuentas; registrar lock en el dominio.
- [ ] `security.txt`, política de divulgación y canal de reporte operativos en todos los idiomas de nivel 1.
- [ ] Runbook de incidentes probado en staging (cuarentena y rotación de clave de firma).

## 11. Riesgo residual (lo que no podemos garantizar)

| Riesgo | Por qué persiste | Mitigación |
|---|---|---|
| Código malicioso sutil que pase el escaneo | Ningún análisis estático detecta toda intención maliciosa | Transparencia (el código queda en el diff del usuario), publishers verificados, reportes, cuarentena rápida, advisories |
| Prompt injection novedosa en reglas | Es un problema abierto de la industria | Escaneo multicapa, delimitación como contenido de terceros, reglas visibles antes de instalar, límite de tamaño |
| Bugs en el código *legítimo* de un paquete | Es software | Advisories + `genpm audit` + updates |
| Compromiso de GitHub o de una cuenta de GitHub del publisher | Dependemos del host Git | SHA pinning (las versiones ya publicadas no cambian), 2FA exigido a verificados, trusted publishing |
| Compromiso de Cloudflare | Proveedor de infraestructura | Firma de manifiestos con clave cuya rotación/revocación no depende solo de Cloudflare; el código sigue verificado por SHA |
| El usuario acepta un MCP o `--force` sin leer | Decisión humana | Prompts claros, comando completo visible, defaults seguros |
