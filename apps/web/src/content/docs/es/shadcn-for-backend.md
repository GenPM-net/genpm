---
title: Como shadcn/ui, pero para módulos de backend
section: Guías
order: 72
---
shadcn/ui popularizó una idea sencilla: en vez de instalar una librería de interfaz, **copias el código del componente en tu proyecto** y es tuyo. GenPM aplica la misma idea a módulos de backend completos (auth, cobros con Stripe, email, tareas en segundo plano, un CMS) y añade lo que necesitan los agentes de IA: reglas y conexiones.

| | Paquete npm | Copiar y pegar (estilo shadcn/ui) | GenPM |
|---|---|---|---|
| Dónde vive el código | `node_modules`, oculto | `src/`, tuyo | `src/`, tuyo |
| Tamaño | Una librería | Un componente de UI | Un módulo entero: código, tablas, rutas |
| Fijado y verificado | Rango de versiones | No | SHA del commit, verificado en cada descarga |
| Scripts de instalación | Pueden ejecutarse | Ninguno | Ninguno, nunca |
| Instrucciones para tu IA | El README, si hay | No | `AGENTS.md` por módulo, solo cuando trabaja en esa carpeta |
| Servicios externos (MCP) | No | No | Declarados y añadidos con tu consentimiento |
| Actualizaciones | `npm update` | A mano | `genpm outdated` / `genpm update` con diff |

## Cuándo encaja

- Tu agente de IA escribe la mayor parte del código y quieres que **se apoye en módulos probados** en vez de improvisar auth o webhooks.
- Quieres leer y cambiar lo que instalas, como haces con los componentes de shadcn.
- Empiezas proyectos a menudo y reescribes siempre las mismas piezas de backend.

## Cuándo no

- Quieres un servicio alojado (Clerk, Auth0) y no quieres el código en tu repo.
- Necesitas un framework que aún no está cubierto: hoy los módulos son de TypeScript para Next.js y Hono.

## Pruébalo

```bash
npx @genpm-net/cli add @core/auth
```

Abre `src/lib/auth/`: es código normal que puedes leer, cambiar y commitear. Mira los [48 paquetes](/es/search) o lee [cómo funciona](/es/docs/how-it-works).
