# @core/storage

[![genpm](https://api.genpm.net/v1/badge/@core/storage.svg)](https://genpm.net/p/@core/storage) ![license](https://img.shields.io/badge/license-MIT-blue)

> File storage for S3-compatible buckets (R2, S3, MinIO) and local disk, with signed direct uploads

A [GenPM](https://genpm.net) module: **source code + AI rules + MCP config**, injected into your project instead of hidden in `node_modules`. The code lands in `src/lib/storage`, pinned to a verified commit, and you own it.

## Install

```bash
genpm add @core/storage
```

No genpm yet? `curl -fsSL https://genpm.net/install.sh | sh` (macOS/Linux), `irm https://genpm.net/install.ps1 | iex` (Windows), or one-off with `npx @genpm-net/cli add @core/storage`.

Or let your AI agent do it: run `genpm mcp setup` once, then ask *"add @core/storage with genpm"* in Claude Code, Cursor, VS Code, Windsurf, Codex or Gemini CLI. It shows you a dry-run plan before writing anything.

## What it does

One `StorageProvider` interface to store and serve files: S3-compatible buckets (Cloudflare R2, AWS S3, MinIO, B2)
signed with SigV4 (`aws4fetch`, works on Node and Workers), plus `local` (disk) and `memory` drivers for development
and tests. Signed direct uploads from the browser with the exact size and content type signed. No media library,
no image processing (that is @core/media). No tables.

## Setup

After `genpm add`, follow these steps (your AI agent finds the same steps in `src/lib/storage/AGENTS.md` and can do them for you):

1. Env for S3/R2 (default driver): `STORAGE_ENDPOINT` (R2: `https://<account>.r2.cloudflarestorage.com`),
   `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, optional `STORAGE_REGION` (default `auto`)
   and `STORAGE_PUBLIC_URL` (CDN/custom domain serving the `public/` prefix).
   Local dev: `STORAGE_DRIVER=local`, `STORAGE_SECRET` (≥ 32 chars), `STORAGE_PUBLIC_URL=http://localhost:3000`
   (files go to `STORAGE_LOCAL_DIR`, default `.storage/`: add it to `.gitignore`), and
   mount the route: Hono `app.route('/api/storage', localStorageRoutes())`; Next.js
   `app/api/storage/[[...key]]/route.ts` with `export { localStoragePut as PUT, localStorageGet as GET } from '@/lib/storage/adapters/next'`.
2. Bucket CORS (S3/R2): allow `PUT` from your origin with header `content-type`.
3. Direct upload: server creates `const key = generateKey('public/media', file.name)` and
   `await getStorage().presignUpload(key, { contentType, size, maxBytes: 10_000_000 })`; the browser does
   `fetch(url, { method: 'PUT', headers, body: file })`.
4. Verify: upload a small file, then `getStorage().head(key)` returns its size.

## What's inside

Paths are relative to `src/lib/storage`.

- `index.ts` — public API: `getStorage()`, `setStorage()`, `generateKey()`, `assertSafeKey()`, `s3Storage()`, types.
- `s3.ts` — S3 driver. `memory.ts` — local/memory drivers and signed tokens. `local-routes.ts` — handlers for them.
- `adapters/hono.ts`, `adapters/next.ts` — upload/download route, only needed with `local`/`memory`.

## At a glance

- **npm dependencies** (proposed, never installed without asking): `aws4fetch`
- **Environment variables** (added to `.env.example`): `STORAGE_DRIVER`, `STORAGE_BUCKET`, `STORAGE_ENDPOINT`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, `STORAGE_PUBLIC_URL`, `STORAGE_SECRET`, `STORAGE_LOCAL_DIR`
- **AI rules**: [`AGENTS.md`](AGENTS.md), loaded by your agent only when it works in `src/lib/storage`

## Security

GenPM installs a 40-character commit SHA (never a branch), verifies an Ed25519-signed manifest, never runs install scripts and scans AI rules for prompt injection. Details: [genpm.net/docs/security](https://genpm.net/docs/security).

## License

MIT — see [LICENSE](LICENSE). Browse the full catalog at [genpm.net](https://genpm.net).
