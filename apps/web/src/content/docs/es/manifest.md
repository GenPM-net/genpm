---
title: Referencia de genpm.json
section: Publicar
order: 21
---
Un manifiesto de origen completo (`genpm.json` en la raíz de tu repo):

```json
{
  "$": 1,
  "n": "@acme/billing",
  "v": "1.2.0",
  "s": { "en": "Stripe subscriptions with webhooks", "es": "Suscripciones de Stripe con webhooks" },
  "d": "src/lib/billing",
  "k": ["stripe", "billing", "subscriptions"],
  "g": { "@core/db": "^1.0.0" },
  "p": { "stripe": "^17.0.0" },
  "e": ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
  "m": [{ "n": "stripe", "c": "npx", "a": ["-y", "@stripe/mcp"], "e": ["STRIPE_SECRET_KEY"] }]
}
```

Las claves tienen un solo carácter para que los manifiestos gasten pocos tokens. Todo lo que muestra manifiestos a un LLM incluye esta leyenda:

```text
genpm keys: n=name v=version s=summary r=repo t=git-ref c=commit-sha d=install-dir i=repo-subdir x=ai-rules-file l=license k=keywords g=genpm-deps p=npm-deps e=env-vars m=mcp-servers(n=name c=command a=args u=url e=env)
```

| Clave | Nombre | Obligatoria | Reglas |
|---|---|---|---|
| `n` | nombre | sí | `@scope/nombre`, en minúsculas. |
| `v` | versión | sí | SemVer estricto, sin prefijo `v` ni metadatos de build. |
| `d` | destino | sí | Ruta POSIX relativa en el proyecto de quien instala. Sin `..` ni rutas absolutas, nunca `.git/`, `node_modules/` ni `.genpm/`, como mucho 8 segmentos. |
| `s` | resumen | recomendada | ≤ 160 caracteres, una línea. Texto o `{ "en": "…", "es": "…" }` (debe incluir `en`). |
| `r` | repo | no | URL HTTPS de Git; por defecto, el remoto `origin`. |
| `t` | ref | no | Un tag o un SHA de 40 caracteres hexadecimales; por defecto `v{v}`. Nunca una rama. |
| `i` | include | no | Subdirectorio del repo que se inyecta (por defecto `.`). |
| `x` | contexto | no | Archivo de reglas de IA relativo a `i` (por defecto `AGENTS.md`, ≤ 16 KB). |
| `l` | licencia | no | Expresión SPDX; prevalece la licencia que detecta GitHub. |
| `k` | palabras clave | no | Hasta 10, `^[a-z0-9-]{2,32}$`. |
| `g` | dependencias genpm | no | `{ "@core/db": "^1.0.0" }`, hasta 10. Las resuelve GenPM. |
| `p` | dependencias npm | no | Se proponen al usuario; nunca se instalan sin su consentimiento. |
| `e` | entorno | no | **Nombres** de variables (`^[A-Z][A-Z0-9_]{1,63}$`), nunca valores. |
| `m` | mcp | no | Hasta 5 servidores: `"@stripe/mcp"` o `{ "n", "c", "a", "u", "e" }`. |
| `_*` | extensiones | no | Las herramientas oficiales las ignoran. Cualquier otra clave es un error. |

El manifiesto de origen **no puede** contener `c` (su propio commit); el registry añade `r`, `t`, `c`, `i`, `x` y `l` al resolverlo.

Excluye archivos con `.genpmignore` (sintaxis de gitignore, relativa a `i`). `.git/`, `.github/`, `node_modules/`, `genpm.json`, `.genpmignore` y `.env*` siempre se excluyen.

## Límites

| Qué | Límite |
|---|---|
| Archivos por paquete | 2.000 |
| Tamaño del paquete | 20 MB (ampliable con `--max-size` al instalar) |
| Un solo archivo | 1 MB |
| Archivo de reglas de IA | 16 KB; se recomiendan ~1.500 tokens, aviso por encima de 4.000 |
| Longitud / profundidad de ruta | 200 caracteres / 8 segmentos |
| Palabras clave · deps genpm · deps npm · variables · servidores MCP | 10 · 10 · 30 · 30 · 5 |

`genpm validate` comprueba todo esto en local con el mismo código que ejecuta el registry.

JSON Schema: [`/schema/v1/genpm.json`](/schema/v1/genpm.json).
