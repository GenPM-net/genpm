#!/bin/sh
# Valida cada módulo del catálogo con el CLI de GenPM del monorepo (compílalo con
# `pnpm turbo run build --filter=@genpm-net/cli...`). Copia el módulo a un directorio temporal porque `validate`
# trabaja sobre la raíz del repo Git y cada módulo se publica en su propio repo.
set -e
root="$(cd "$(dirname "$0")/.." && pwd)"
for m in "$@"; do
  tmp="$(mktemp -d)"
  cp -r "$root/src/lib/$m/." "$tmp/"
  (cd "$tmp" && git init -q && git add -A && git -c user.email=dev@genpm.net -c user.name=dev commit -qm init)
  node "$root/../packages/cli/dist/bin.mjs" validate "$tmp" || { rm -rf "$tmp"; exit 1; }
  rm -rf "$tmp"
done
