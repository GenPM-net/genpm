# Workspace de desarrollo del catálogo

Paquetes del [catálogo](../docs/catalogo/README.md) (ADR-033) en desarrollo. Igual que las semillas, este directorio
imita un proyecto consumidor: cada módulo vive en `src/lib/<nombre>` tal y como lo inyecta GenPM, así los imports
relativos entre módulos (`../db/index.js`) se prueban como quedarán tras `genpm add`.

- `src/lib/db`, `src/lib/auth`, `src/lib/email`: copias de las semillas publicadas (no se editan aquí; se editan en sus repos).
- `src/lib/billing`: **@core/billing 2.0** preparado aquí sobre `@core/stripe` (pendiente de llevar al repo `genpm-net/billing` y publicar).
- El resto: paquetes nuevos. Al publicar, cada carpeta se separa en su repo `github.com/genpm-net/<nombre>` con
  `git subtree split --prefix catalog/src/lib/<nombre>` y se publica con el CLI.

```bash
pnpm install
pnpm check                          # tsc + vitest (PGlite) + migración conjunta de todos los módulos
node scripts/meta.mjs <modulo>      # genpm.json, LICENSE y .genpmignore desde scripts/manifests.json
./scripts/validate.sh <modulo>…     # genpm validate con el CLI del monorepo
```

| Módulo | Tarea | Estado |
|---|---|---|
| `contracts` | CAT-00-03 | Implementado y validado · pendiente de publicar |
| `rbac` | CAT-CMS-01 | Implementado y validado · pendiente de publicar |
| `jobs` | CAT-CMS-03 | Implementado y validado · pendiente de publicar |
| `storage` | CAT-CMS-02 | Implementado y validado · pendiente de publicar (falta prueba contra MinIO en CI) |
| `antispam` | CAT-CMS-04 | Implementado y validado · pendiente de publicar |
| `content` | CAT-CMS-06 | Implementado y validado · pendiente de publicar |
| `search` | CAT-CMS-11 | Implementado y validado · pendiente de publicar |
| `site` | CAT-CMS-09 | Implementado y validado · pendiente de publicar |
| `seo` | CAT-CMS-10 | Implementado y validado · pendiente de publicar |
| `forms` | CAT-CMS-12 | Implementado y validado · pendiente de publicar |
| `media` | CAT-CMS-07 | Implementado y validado · pendiente de publicar |
| `rich-text` | CAT-CMS-08 | Implementado y validado · pendiente de publicar |
| `blog` | CAT-BLG-01 | Implementado y validado · pendiente de publicar |
| `comments` | CAT-BLG-02 | Implementado y validado · pendiente de publicar |
| `newsletter` | CAT-BLG-03 | Implementado y validado · pendiente de publicar |
| `money` | CAT-STO-01 | Implementado y validado · pendiente de publicar |
| `stripe` (+ `billing` 2.0) | CAT-STO-02 | Implementado y validado · pendiente de publicar |
| `catalog` | CAT-STO-03 | Implementado y validado · pendiente de publicar |
| `cart` | CAT-STO-04 | Implementado y validado · pendiente de publicar |
| `orders` | CAT-STO-05 | Implementado y validado · pendiente de publicar |
| `shipping` | CAT-STO-06 | Implementado y validado · pendiente de publicar |
| `checkout` | CAT-STO-07 | Implementado y validado · pendiente de publicar |
| `discounts` | CAT-STO-08 | Implementado y validado · pendiente de publicar |
| `reviews` | CAT-STO-09 | Implementado y validado · pendiente de publicar |
| `pricing` | CAT-DRP-01 | Implementado y validado · pendiente de publicar |
| `suppliers` (adaptador manual) | CAT-DRP-02 | Implementado y validado · pendiente de publicar |
| `consent` | CAT-LND-01 | Implementado y validado · pendiente de publicar |
| `pixels` | CAT-LND-02 | Implementado y validado · pendiente de publicar |
| `ui` | CAT-00-04 | Implementado y validado (axe + contraste AA) · pendiente de publicar |
