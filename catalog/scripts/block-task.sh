#!/bin/sh
# Marca una tarea del catálogo como BLOCKED tras implementarla: falta el repo, publicar y las pruebas de agente.
# Uso: scripts/block-task.sh <ID> <modulo>
set -e
cd "$(dirname "$0")/../.."
pnpm -s tasks block "$1" >/dev/null
python3 - "$1" "$2" <<'PY'
import sys, datetime
tid, name = sys.argv[1], sys.argv[2]
p = 'tasks/11-catalogo.md'
lines = open(p).read().split('\n')
note = f"  - Bloqueo: implementado, con tests y `genpm validate` 5/5 en `catalog/src/lib/{name}` ({datetime.date.today()}). Falta crear el repo `genpm-net/{name}` (fundador), publicar, pruebas de agente y revisión ADR-023."
for i, l in enumerate(lines):
    if f'`{tid}`' in l:
        if not lines[i + 1].startswith('  - Bloqueo'):
            lines.insert(i + 1, note)
        break
open(p, 'w').write('\n'.join(lines))
PY
pnpm -s tasks sync >/dev/null
pnpm -s tasks check
