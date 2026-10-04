# Runbook de incidentes de seguridad

Procedimientos operativos de `security.md` §9. Cada paso indica el comando exacto. Todo lo que se hace en producción se
ensaya antes en staging (`--env staging`, base `genpm-registry-staging`) y queda registrado en el canal de incidentes.

| Severidad | Contención | Comunicación |
|---|---|---|
| Crítica (paquete malicioso, clave de firma comprometida, fuga cross-tenant) | ≤ 1 h | Advisory + redes + status ≤ 4 h |
| Alta (bypass de `safePath`, token de publisher robado) | ≤ 24 h | Advisory ≤ 48 h |

Canal de entrada: hello@genpm.net con asunto `[SECURITY]` y GitHub Private Vulnerability Reporting. Primera respuesta ≤ 48 h.

---

## 1. Cuarentena de un paquete

Un paquete en cuarentena responde **451** en `resolve`, la web lo muestra "En revisión" y el CLI/MCP fallan con
`E_QUARANTINED`. Los proyectos que ya lo tienen instalado no cambian; `genpm audit` les avisará cuando se publique el advisory.

### 1.1 Aplicar

```bash
cd apps/registry
# Una versión
npx wrangler d1 execute genpm-registry --remote --command \
  "UPDATE package_versions SET status='quarantined' WHERE version='1.2.0' AND package_id=(SELECT id FROM packages WHERE full_name='@acme/billing')"
# El paquete entero
npx wrangler d1 execute genpm-registry --remote --command \
  "UPDATE packages SET status='quarantined' WHERE full_name='@acme/billing'"
# Un scope entero
npx wrangler d1 execute genpm-registry --remote --command \
  "UPDATE packages SET status='quarantined' WHERE full_name LIKE '@acme/%'"
```

### 1.2 Purgar la caché

Las respuestas de lectura se cachean 60 s con `stale-while-revalidate` de 300 s. Para que el 451 sea inmediato, purga
la caché de la zona de `api.genpm.net` (Dashboard → Caching → Purge, o API):

```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/purge_cache" \
  -H "Authorization: Bearer $CF_PURGE_TOKEN" -H "content-type: application/json" \
  --data '{"prefixes":["api.genpm.net/v1/resolve/@acme/billing","api.genpm.net/v1/packages/@acme/billing"]}'
```

Sin purga, el 451 llega como mucho en ~6 minutos.

### 1.3 Verificar

```bash
curl -s -o /dev/null -w '%{http_code}\n' "https://api.genpm.net/v1/resolve/@acme/billing?range=latest"   # → 451
genpm add @acme/billing --dry-run                                                                       # → E_QUARANTINED
```

### 1.4 Advisory

```bash
npx wrangler d1 execute genpm-registry --remote --command \
  "INSERT INTO advisories (id, public_id, package_id, affected_range, patched_version, severity, title, description, published_at)
   VALUES ('adv_<ulid>', 'GENPM-2026-NNNN', (SELECT id FROM packages WHERE full_name='@acme/billing'), '<=1.2.0', NULL, 'critical',
           '{\"en\":\"…\"}', '{\"en\":\"…\"}', unixepoch()*1000)"
```

Aparece en `/security/advisories`, en el feed JSON y en `genpm audit`.

### 1.5 Levantar

Tras la revisión: `status='active'` (falso positivo), o `yank` de las versiones afectadas y suspensión de la cuenta
(confirmado). Purga de nuevo la caché.

> Ensayado en local (D6-S-08): `UPDATE packages SET status='quarantined'` → `resolve` 451 → el CLI muestra `E_QUARANTINED`
> → `status='active'` → 200.

---

## 2. Rotación de la clave de firma

Los manifiestos se firman con Ed25519 (`security.md` §4.3). El cliente lleva fijadas la clave activa y la siguiente
(`packages/core/src/keys.ts`), así que se puede pasar a la siguiente sin publicar un CLI nuevo.

### 2.1 Rotación programada (anual) o compromiso

1. **Activar la clave siguiente** (ya está en los clientes publicados):

   ```bash
   cd apps/registry
   npx wrangler secret put SIGNING_KEY_ID      # k2
   npx wrangler d1 execute genpm-registry --remote --command \
     "UPDATE signing_keys SET status = CASE id WHEN 'k2' THEN 'active' WHEN 'k1' THEN 'retired' ELSE status END"
   ```

   Las publicaciones nuevas salen firmadas con `k2` desde ese momento.

2. **Re-firmar lo publicado**: el cron horario (`resignStale`) re-firma por lotes de 500 todas las versiones cuya firma
   no es de la clave activa. Para no esperar, dispáralo a mano: `npx wrangler triggers` no ejecuta crons, así que usa el
   dashboard (Workers → genpm-registry → Triggers → Cron → "Trigger") tantas veces como haga falta. Comprueba que no queda
   nada sin re-firmar:

   ```bash
   npx wrangler d1 execute genpm-registry --remote --command \
     "SELECT COUNT(*) FROM package_versions WHERE substr(signature,1,3) != 'k2:'"   # → 0
   ```

3. **Generar la nueva clave siguiente** (`k3`) en la máquina de confianza, añadirla al secreto y fijarla en
   `packages/core/src/keys.ts` para la próxima release del CLI:

   ```bash
   node scripts/gen-signing-keys.mjs        # usa solo la k nueva; guarda root.private OFFLINE
   npx wrangler secret put SIGNING_KEYS     # {"k2":"…","k3":"…"}
   ```

### 2.2 Solo si la clave está comprometida: revocarla

Después del paso 2 (todo re-firmado), firma la lista de revocación **offline** con la clave raíz y publícala:

```bash
node scripts/sign-revocation.mjs --root /media/offline/root.private --revoke k1 --previous ultima-lista.json
# → imprime la lista firmada y el INSERT para registry_meta
npx wrangler d1 execute genpm-registry --remote --command "<INSERT impreso>"
curl -s https://api.genpm.net/v1/keys | jq .revocation     # la lista nueva
```

Qué pasa en los clientes:

- `genpm add` / MCP descargan la lista de `GET /v1/keys`, la aceptan solo si la firma de la clave raíz es válida y la
  guardan en `~/.genpm/cache/revocation/`. La caché es **monótona**: un registry que deje de servir la lista o sirva una
  más antigua no puede "des-revocar" una clave.
- Cualquier manifiesto firmado con `k1` falla con `E_SIGNATURE` (`reason: revoked_key`).
- `genpm audit` marca como `GENPM-SIGNATURE` los paquetes del lock firmados con `k1`. El usuario lo arregla con
  `genpm add <paquete>`: mismo commit y firma nueva verificada ⇒ solo se actualiza `sg` en `genpm.lock`, sin tocar archivos.

Comunicación: advisory "rotación de clave de firma" con la fecha, las claves afectadas y el comando `genpm add`.

> Cubierto por tests: `apps/registry/test/resign.test.ts` (re-firma por lotes, idempotente, verificable con la clave
> nueva), `packages/core/src/revocation.test.ts` (firma raíz, listas falsificadas, monotonía, una caché por registry) y
> `packages/core/test/install.test.ts` (rechazo `revoked_key` end to end y refresco de `sg` sin tocar archivos).
> `scripts/sign-revocation.mjs` y el `INSERT` ensayados contra la D1 local.

---

## 3. Otros procedimientos

| Situación | Acción |
|---|---|
| Token de publisher robado | `UPDATE api_tokens SET revoked_at = unixepoch()*1000 WHERE account_id = ?` · revisar `audit_log` · yank de lo publicado con ese token |
| Cuenta maliciosa | `UPDATE accounts SET status='suspended'` + cuarentena de su scope (§1) |
| Fuga cross-tenant | Modo solo lectura: `npx wrangler secret put READ_ONLY` = `1` · post-mortem público |
| Repojacking (`E_REPO_CHANGED`) | Cuarentena del paquete y contacto con el owner original |

Post-mortem público y sin culpables para toda incidencia alta o crítica.

## 4. Entornos

| Entorno | Web | API | D1 | Clave de firma |
|---|---|---|---|---|
| staging | https://staging.genpm.net (noindex) | https://api.staging.genpm.net | `genpm-registry-staging` | `s1` (solo staging) |
| producción | https://genpm.net | https://api.genpm.net | `genpm-registry` | `k1` activa, `k2` siguiente |

La zona `genpm.net` está en Cloudflare (plan Free) desde el 2026-10-04; el correo sigue en Piensa (`mx.buzondecorreo.com`)
y sus registros MX/SPF/CNAME se gestionan ahora en el DNS de Cloudflare. La web de producción no se despliega hasta que
`owner.json` tenga los datos del titular (`scripts/check-legal.mjs`); mientras, `genpm.net` sigue apuntando al hosting
de Piensa. Al desplegarla hay que borrar antes los registros A de `genpm.net` y `www` (el custom domain del Worker los
sustituye).

```bash
pnpm --filter @genpm/registry exec wrangler deploy [--env staging]   # API
pnpm --filter @genpm/web deploy:staging                              # web staging
pnpm --filter @genpm/web deploy                                      # web producción (exige owner.json completo)
GENPM_REGISTRY=https://api.staging.genpm.net \
GENPM_PUBLIC_KEYS='{"s1":"HT1CBlCFIllWWGS8QUvAcEb_SMUL66MvnUfuOc0m6bc"}' genpm search db   # CLI contra staging
```
