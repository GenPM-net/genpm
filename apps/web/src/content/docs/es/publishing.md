---
title: Tu primer paquete
section: Publicar
order: 20
---
Tu código sigue en GitHub; el registry guarda el manifiesto y el commit al que apunta.

**Desde la web, sin terminal:** inicia sesión en [genpm.net/publish](/publish), elige uno de tus repositorios y GenPM te dice lo que le falta. Te genera el `genpm.json`, y cada arreglo abre GitHub con el archivo listo para hacer commit (GenPM nunca pide permiso de escritura). Cuando todo esté en verde, publicas desde la misma página.

**Desde la terminal:**

```bash
genpm init          # crea genpm.json, AGENTS.md y .genpmignore
genpm validate      # el mismo escáner que el registry
git tag v1.0.0 && git push --tags
genpm login
genpm publish
```

`publish` comprueba que no tengas cambios sin commit y que el tag en `origin` apunte al mismo commit que el tuyo (`E_REF_NOT_PUSHED`). Después el registry lee `genpm.json` **desde GitHub** en ese commit (nunca desde tu máquina), lo valida, escanea el árbol, firma el manifiesto resuelto y lista el paquete.

Las versiones son inmutables: `(nombre, versión)` nunca se puede publicar dos veces, ni siquiera tras retirarla. Las ramas siempre se rechazan (`E_REF_MUTABLE`).

Pruébalo antes sin publicar nada:

```bash
genpm publish --dry-run
```

## Qué comprueba el registry

- Que el tag existe en GitHub y apunta al commit que subiste.
- Que `genpm.json` es válido y su nombre coincide con un scope en el que puedes publicar.
- Que el árbol pasa el escaneo: sin archivos que se ejecuten solos (scripts de instalación, `.npmrc`, `.vscode/tasks.json`, hooks de git…), sin secretos, sin enlaces simbólicos y con rutas seguras.
- Que las reglas de IA no contienen prompt injection. Si algo parece sospechoso, la versión queda **en revisión** y una persona la revisa en menos de 24 horas hábiles.

## Prereleases y dist-tags

Una prerelease como `1.3.0-beta.1` va automáticamente al dist-tag `next`, así `latest` sigue apuntando a tu última versión estable. Los usuarios la eligen con `genpm add @acme/billing@next`. Usa `--dist-tag` para elegir otro tag.

## Monorepos

Publica un paquete que vive en un subdirectorio con `--manifest packages/billing/genpm.json` y pon `i` en ese directorio para que solo se inyecte él. Usa tags por paquete, como `billing@1.2.0`.

## Retirar una versión

```bash
genpm yank @acme/billing@1.2.0 --reason "rompe los webhooks con la API de Stripe 2026-09"
```

Una versión retirada sigue siendo inmutable y verificable para los proyectos que ya la usan, pero las instalaciones nuevas la saltan y la web muestra el motivo.

## Scopes

Tu scope es tu usuario de GitHub o una de tus organizaciones. Scopes como `@core`, `@genpm` u `@official` están reservados.

## CI

`genpm init --workflow` añade un workflow de GitHub Actions que publica cuando haces push de un tag `v*`, con `GENPM_TOKEN` como secreto.

### Sin tokens: publicación de confianza

Autoriza el repositorio una vez en [Publicación de confianza](/settings/publishing) (si quieres, solo un archivo de workflow o un environment). Después da al job `id-token: write` y quita `GENPM_TOKEN`: `genpm publish` pide a Actions un token OIDC y GenPM lo canjea por un token de 15 minutos que solo puede publicar en tu scope desde ese repositorio.

```yaml
permissions:
  contents: read
  id-token: write   # trusted publishing
steps:
  - uses: actions/checkout@v4
    with: { fetch-depth: 0 }
  - run: npx -y @genpm-net/cli publish --yes
```

### Desde GitLab

Los proyectos de GitLab solo publican con publicación de confianza: autoriza el proyecto público (por ejemplo `mi-grupo/sub/mi-paquete`) en [Publicación de confianza](/settings/publishing) eligiendo GitLab como host y declara un `id_tokens` con audiencia `genpm` llamado `GENPM_ID_TOKEN`. `genpm publish` lo canjea por un token de 15 minutos que solo puede publicar desde ese proyecto. Los tokens personales no pueden publicar repositorios de GitLab.

```yaml
# .gitlab-ci.yml
publish:
  image: node:22
  rules:
    - if: $CI_COMMIT_TAG
  id_tokens:
    GENPM_ID_TOKEN:
      aud: genpm
  script:
    - npx -y @genpm-net/cli publish --yes
```
