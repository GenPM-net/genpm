---
title: Inicio rápido
section: Primeros pasos
order: 1
---
Añade tu primer módulo en un minuto. Solo necesitas **git 2.25+** (sin él, GenPM usa los tarballs de GitHub).

## 1. Instala genpm

macOS y Linux:

```bash
curl -fsSL https://genpm.net/install.sh | sh
```

Windows (PowerShell):

```powershell
irm https://genpm.net/install.ps1 | iex
```

Es un único binario, sin Node.js. Otras opciones (npm, una versión concreta, mirrors) en [Instalación](/docs/install).

## 2. Añade un paquete

Ejecútalo en la raíz de tu proyecto. GenPM muestra el plan completo y pregunta antes de escribir nada.

```bash
genpm add @core/auth
```

GenPM resuelve `@core/auth` y su dependencia `@core/db`, verifica la firma del registry de cada manifiesto, descarga el commit exacto y lo escanea en local antes de mostrarte el plan.

## 3. Mira qué cambió

```bash
git status
```

- El código está en `src/lib/auth` y `src/lib/db`: ahora es tu código.
- Las reglas que lee tu IA están en `src/lib/auth/AGENTS.md`.
- `genpm.lock` ancla cada paquete a un SHA de commit de 40 caracteres.
- `.env.example` lista las variables que hay que configurar (solo nombres, nunca valores).

## 4. Deja que tu IA siga

Abre tu agente y pídele que integre el módulo. Lee las reglas del módulo y sigue su sección **Integración**:

```text
Integra @core/auth siguiendo src/lib/auth/AGENTS.md. Añade login con GitHub.
```

Conecta el [servidor MCP](/es/docs/mcp) y tu agente también podrá hacer el paso 1.
