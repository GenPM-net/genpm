---
title: Login con GitHub en Next.js
section: Guías
order: 70
---
Quieres "Entrar con GitHub" en una app de Next.js (App Router), con sesiones de verdad en tu propia base de datos, sin cablear OAuth, cookies y rotación de sesiones a mano. `@core/auth` deja ese código en `src/lib/auth`, donde puedes leerlo y cambiarlo.

## 1. Instala el módulo

```bash
npx @genpm-net/cli add @core/auth
```

También instala `@core/db` (Postgres + Drizzle), porque auth guarda ahí usuarios y sesiones. No se ejecuta nada en tu máquina: el código llega a `src/lib/`, anclado a un commit en `genpm.lock`, con un `AGENTS.md` por módulo para tu IA.

¿Prefieres pedírselo a tu agente? Con el [servidor MCP](/es/docs/mcp) conectado, dile: *"Añade login con GitHub a este proyecto con genpm."* Busca, te enseña los archivos y te pregunta antes de instalar.

## 2. Configura el entorno

```bash
# .env.local
DATABASE_URL=postgres://…
AUTH_SECRET=   # openssl rand -base64 32
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

Crea una OAuth app en GitHub con la URL de callback `http://localhost:3000/auth/callback/github` (y la de producción después). Google funciona igual con `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`.

## 3. Crea las tablas

Sigue `src/lib/db/AGENTS.md`: añade `drizzle-kit` y genera y aplica una migración para todos los módulos instalados.

## 4. Monta tres rutas

```ts
// app/auth/login/[provider]/route.ts
export { loginRoute as GET } from '@/lib/auth/adapters/next';
// app/auth/callback/[provider]/route.ts
export { callbackRoute as GET } from '@/lib/auth/adapters/next';
// app/auth/logout/route.ts
export { logoutRoute as POST } from '@/lib/auth/adapters/next';
```

Borra `src/lib/*/adapters/hono.ts`: un proyecto Next.js no usa Hono.

## 5. Úsalo

```tsx
import { cookies } from 'next/headers';
import { getUser } from '@/lib/auth/adapters/next';

export default async function Page() {
  const user = await getUser(await cookies());
  return user ? <p>Hola {user.name}</p> : <a href="/auth/login/github?returnTo=/">Entrar con GitHub</a>;
}
```

Abre `/auth/login/github`, completa el flujo y ya estás dentro. Las sesiones se guardan cifradas con hash, se renuevan solas y se revocan al cerrar sesión.

**Siguiente:** cobra suscripciones con [Suscripciones con Stripe en Next.js](/es/docs/nextjs-stripe-subscriptions).
