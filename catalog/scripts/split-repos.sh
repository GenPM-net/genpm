#!/bin/sh
# Crea los repos github.com/GenPM-net/<módulo> del catálogo (públicos, como las semillas) y sube a cada uno su
# carpeta con la historia (git subtree split) y el tag v<versión de genpm.json>. Lo ejecuta el fundador con `gh`
# autenticado como administrador de la organización (la app de agentes no puede crear repos).
#
# Uso: scripts/split-repos.sh [--dry-run] [módulo…]     (sin módulos: todos, semillas incluidas)
# Repos nuevos: se crean y reciben `main` + tag `v<versión>`. Repos que ya existen (semillas, billing): su historia es
# otra, así que se sube la rama `catalog-sync` para revisarla y fusionarla allí (ADR-034, billing 2.0); sin tag.
# Después: `genpm publish` en cada repo (o el workflow de publicación) cuando el registro esté desplegado.
set -eu
ORG=GenPM-net
DRY=0
[ "${1:-}" = "--dry-run" ] && { DRY=1; shift; }
root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$root"
mods="$*"
if [ -z "$mods" ]; then
  mods="$(ls catalog/src/lib) kit-cms kit-blog kit-landing kit-store kit-dropshipping"
fi
run() { if [ "$DRY" = 1 ]; then echo "+ $*"; else "$@"; fi; }
for m in $mods; do
  case "$m" in
    kit-*) prefix="catalog/src/app/(${m#kit-})" ;;
    *) prefix="catalog/src/lib/$m" ;;
  esac
  [ -f "$prefix/genpm.json" ] || { echo "skip $m: no genpm.json"; continue; }
  version="$(node -p "require('./$prefix/genpm.json').v")"
  summary="$(node -p "require('./$prefix/genpm.json').s.en")"
  echo "== $m ($prefix) v$version"
  branch="split/$m"
  run git subtree split --prefix "$prefix" -b "$branch"
  if gh repo view "$ORG/$m" >/dev/null 2>&1; then
    run git push --force "https://github.com/$ORG/$m.git" "$branch:refs/heads/catalog-sync"
    echo "   $ORG/$m ya existía: revisa y fusiona la rama catalog-sync allí (luego tag v$version)."
  else
    run gh repo create "$ORG/$m" --public --description "@core/$m — $summary (GenPM catalog)"
    run gh repo edit "$ORG/$m" --add-topic genpm --add-topic source-modules --add-topic ai-agents --add-topic mcp --add-topic typescript
    run git push "https://github.com/$ORG/$m.git" "$branch:main"
    run git tag -f "$m-v$version" "$branch"
    run git push "https://github.com/$ORG/$m.git" "refs/tags/$m-v$version:refs/tags/v$version"
  fi
  run git branch -D "$branch"
done
