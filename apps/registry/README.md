# apps/registry — GenPM Edge Registry

Cloudflare Worker (Hono) + D1. **Solo almacena metadatos**; nunca aloja archivos de paquetes.

- Spec: [docs/api-spec.md](../../docs/api-spec.md)
- Bindings: `DB` (D1), `INSTALLS` (Analytics Engine), `RL_PUBLIC` / `RL_AUTH` (Rate Limiting), secretos `GITHUB_APP_*`, `TOKEN_PEPPER`.
- Cron triggers: rollup de instalaciones (horario), popularidad + patrocinios (diario).

Estructura prevista:
```
src/
├── index.ts            # app Hono + export default { fetch, scheduled }
├── routes/             # search, packages, resolve, publish, auth, tokens, admin
├── services/           # github (resolve ref → sha, fetch manifest), scan, ranking
├── db/                 # queries tipadas (sin ORM en MVP) + mappers
├── middleware/         # auth, rate-limit, cache, problem+json
└── cron/               # rollups
migrations/             # 0001_init.sql … (wrangler d1 migrations)
test/                   # vitest + @cloudflare/vitest-pool-workers
```

## Desarrollo local

```bash
cp .dev.vars.example .dev.vars          # rellena SIGNING_KEYS (node ../../scripts/gen-signing-keys.mjs --dev)
pnpm migrate:local
npx wrangler d1 execute DB --local --file seeds/fixtures.sql   # fixtures firmados con dev1 (SHA ficticios: search/info/resolve, no instalan)
pnpm dev                                # http://localhost:8787 (ENVIRONMENT=development)
GENPM_REGISTRY=http://localhost:8787 genpm search auth
```

El CLI acepta la clave `dev1` solo contra registries locales (`localhost`). `pnpm dev` fuerza `ENVIRONMENT=development`:
`wrangler dev` reescribe la URL al host de la primera ruta (`http://api.genpm.net`), y sin eso la redirección a HTTPS
de `src/app.ts` respondería 301 en bucle.
