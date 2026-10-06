# Workspace de desarrollo del catálogo

Paquetes del [catálogo](../docs/catalogo/README.md) (ADR-033) en desarrollo. Igual que las semillas, este directorio
imita un proyecto consumidor: cada módulo vive en `src/lib/<nombre>` tal y como lo inyecta GenPM, así los imports
relativos entre módulos (`../db/index.js`) se prueban como quedarán tras `genpm add`.

- `src/lib/db`, `src/lib/auth`, `src/lib/email`: copias de las semillas publicadas (no se editan aquí; se editan en sus repos).
- El resto: paquetes nuevos. Al publicar, cada carpeta se separa en su repo `github.com/genpm-net/<nombre>` con
  `git subtree split --prefix catalog/src/lib/<nombre>` y se publica con el CLI.

```bash
pnpm install
pnpm check                          # tsc + vitest (PGlite, sin servicios externos)
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
