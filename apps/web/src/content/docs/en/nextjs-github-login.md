---
title: Add GitHub login to Next.js
section: Guides
order: 70
---
You want "Sign in with GitHub" in a Next.js (App Router) app, with real sessions in your own database, and you would rather not wire OAuth, cookies and session rotation by hand. `@core/auth` drops that code into `src/lib/auth`, where you can read and change it.

## 1. Install the module

```bash
npx @genpm-net/cli add @core/auth
```

It also installs `@core/db` (Postgres + Drizzle) because auth stores users and sessions there. Nothing runs on your machine: the code lands in `src/lib/`, pinned to a commit in `genpm.lock`, with an `AGENTS.md` per module for your AI.

Prefer to ask your agent? With the [MCP server](/docs/mcp) connected, say: *"Add GitHub login to this project with genpm."* It searches, shows you the files and asks before installing.

## 2. Configure the environment

```bash
# .env.local
DATABASE_URL=postgres://…
AUTH_SECRET=   # openssl rand -base64 32
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

Create a GitHub OAuth app with the callback URL `http://localhost:3000/auth/callback/github` (and your production URL later). Google works the same way with `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

## 3. Create the tables

Follow `src/lib/db/AGENTS.md`: add `drizzle-kit`, then generate and apply one migration for every installed module.

## 4. Mount three routes

```ts
// app/auth/login/[provider]/route.ts
export { loginRoute as GET } from '@/lib/auth/adapters/next';
// app/auth/callback/[provider]/route.ts
export { callbackRoute as GET } from '@/lib/auth/adapters/next';
// app/auth/logout/route.ts
export { logoutRoute as POST } from '@/lib/auth/adapters/next';
```

Delete `src/lib/*/adapters/hono.ts`: a Next.js project does not use Hono.

## 5. Use it

```tsx
import { cookies } from 'next/headers';
import { getUser } from '@/lib/auth/adapters/next';

export default async function Page() {
  const user = await getUser(await cookies());
  return user ? <p>Hi {user.name}</p> : <a href="/auth/login/github?returnTo=/">Sign in with GitHub</a>;
}
```

Open `/auth/login/github`, finish the flow and you are in. Sessions are stored hashed, renewed automatically and revoked on logout.

**Next:** add subscriptions with [Stripe subscriptions in Next.js](/docs/nextjs-stripe-subscriptions).
