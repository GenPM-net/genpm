---
title: Usar paquetes
section: Usar paquetes
order: 10
---
## add

```bash
genpm add @core/billing            # última versión
genpm add @core/auth@^1.2          # rango semver
genpm add @core/db --dest packages/db
genpm add @core/billing --dry-run  # muestra el plan sin escribir nada
```

GenPM hace tres preguntas por separado: inyectar el código, añadir servidores MCP (mostrando el comando completo) y ejecutar el comando del gestor de paquetes para las dependencias npm. `--yes` solo responde a la primera; usa `--mcp` e `--install-deps` para las otras.

Si el destino existe y no está vacío, `add` falla con `E_DEST_CONFLICT`. `--force` mueve antes el contenido anterior a `.genpm/backup/<timestamp>/`.

## search e info

```bash
genpm search stripe
genpm info @core/billing          # manifiesto, dependencias, MCP, variables de entorno y las reglas de IA completas
genpm info @core/billing --rules  # solo las reglas
```

## list y remove

```bash
genpm list
genpm remove @core/auth
```

`list` compara cada archivo inyectado con su SHA-256 registrado (cambios locales). `remove` se niega a borrar código que has modificado (`E_DRIFT`): usa `--keep-code` para conservarlo o `--force` para borrarlo igualmente. Un paquete del que depende otro no se puede quitar primero (`E_REQUIRED_BY`). Al quitar un paquete también se quitan sus servidores MCP y los archivos que GenPM había creado y quedan vacíos.

## outdated y audit

```bash
genpm outdated
genpm audit   # añádelo a tu CI como: npx @genpm-net/cli audit
```

`audit` verifica la integridad de los archivos, la firma del registry de cada entrada del lock, los avisos de seguridad, las versiones retiradas y las cuarentenas. Sale con código 6 si hay hallazgos altos o críticos.

## update y diff

```bash
genpm diff @core/auth
genpm update @core/auth
```

`diff` muestra qué cambió upstream desde tu versión instalada, con las rutas apuntando ya a tu carpeta (aplícalo con `git apply --3way`). `update` hace un merge de tres vías: los archivos que no tocaste reciben la versión nueva, las líneas que cambiaste se conservan y, si ambos lados cambiaron las mismas líneas, el archivo queda con los marcadores estándar `<<<<<<<` y el comando sale con código 4. Un archivo eliminado upstream que modificaste se conserva.

`genpm diff --local` lista también tus cambios locales; `genpm update --dry-run` muestra el plan sin escribir nada.

## Salida JSON

Todos los comandos aceptan `--json` (una línea, en inglés, sin preguntas). Sin terminal interactiva, cualquier pregunta sin responder falla con `E_CONFIRM_REQUIRED` (código de salida 2) y no se escribe nada.

## Recetas: varios paquetes a la vez

Una receta instala con un comando varios paquetes que funcionan juntos, con el mismo plan y las mismas preguntas que `genpm add`. Las recetas que cura GenPM están en [/recipes](/recipes); tu equipo también puede tener la suya como archivo JSON en el repositorio.

```bash
genpm compose --list
genpm compose saas-starter --dry-run
genpm compose ./stack.json
```

```json
{ "name": "my-stack", "p": ["@core/db", "@core/auth@^1.2"] }
```

## Registros privados

Los equipos pueden guardar paquetes de repositorios privados en un registro privado (`genpm registry create acme --owner mi-org`, o [Ajustes › Registros privados](/settings/registries)). No existe para quien no es miembro. Apunta tu scope a él en `.genpmrc` e inicia sesión contra él; `genpm add` funciona igual. Los miembros leen los paquetes `internal`; los `private` necesitan un permiso (`genpm access grant @acme/api team:mi-org/backend read`). La GitHub App de GenPM tiene que estar instalada en la organización para que el registro lea sus repositorios privados.

```ini
# .genpmrc
@acme:registry=https://api.genpm.net/r/acme
# ENT-03: policy
policy=https://api.genpm.net/r/acme
```

```bash
genpm login --registry https://api.genpm.net/r/acme
genpm add @acme/payments
```
