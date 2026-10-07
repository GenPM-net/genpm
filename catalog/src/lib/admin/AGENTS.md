# @core/admin — rules for AI agents

## Purpose
Admin panel generated from `AdminResource` descriptions (from @core/contracts): navigation, dashboard widgets,
searchable/sortable lists, create/edit forms, record actions with confirmation, and delete. No per-resource screens:
any module that exports an `AdminResource` appears in the panel. Server side: session from @core/auth, permissions
from @core/rbac (`admin:access` + `<resource>:<action>`), CSRF protection on writes and an audit log of every change.
Table: `admin_audit`.

## Map
- `index.ts` — server API: `defineAdmin`, `handleAdminApi`, `adminContextFor`, `listAudit`, `auditAdminResource`, `countWidget`, `listWidget`, `fieldsFromZod`.
- `client.ts` — `'use client'`: `AdminApp`, `createAdminApi`, `FieldControl`, `defaultLabels`, renderer types.
- `admin.css` — layout on @core/ui tokens. `constants.ts` — `ADMIN_HEADER` (shared by server and client).
- `adapters/hono.ts` — `adminRoutes(admin)`. `adapters/next.ts` — `adminRouteHandlers(admin)`.

## Integration
1. Install @core/auth, @core/rbac and @core/ui first; run migrations as in `src/lib/db/AGENTS.md` (`admin_audit`).
2. Create `src/genpm/admin.ts`:
   ```ts
   import { defineAdmin, auditAdminResource } from '@/lib/admin';
   import { mediaAdminResource } from '@/lib/media';
   export const admin = defineAdmin({ title: 'My site', resources: [mediaAdminResource, auditAdminResource], widgets: [] });
   ```
   Every installed module's `AGENTS.md` says which resources to add here.
3. API route. Next: `app/api/admin/[...path]/route.ts` →
   `export const { GET, POST, PUT, DELETE } = adminRouteHandlers(admin); export const dynamic = 'force-dynamic';`
   Hono: `app.route('/api/admin', adminRoutes(admin))`.
4. Page. Next: `app/admin/[[...path]]/page.tsx` renders a client component that imports `../lib/ui/ui.css`,
   `../lib/admin/admin.css` and returns `<AdminApp basePath="/admin" path={(await params).path?.join('/') ?? ''} />`.
   Protect the page itself too (redirect to sign-in when there is no session) and add `robots: { index: false }`.
5. Rich text, media pickers or blocks: pass `renderers={{ richText: MyEditorField, media: MyMediaPicker }}`.
   Without them those fields fall back to a JSON textarea / relation select.
6. Translate the UI with `labels={{ save: t('admin.save'), … }}` (keys: `defaultLabels`).
7. Verify: a user without `admin:access` gets 403 on `/api/admin/schema`; an editor sees only their resources; an edit
   creates a row in `admin_audit` with before/after.

## Conventions
- Resources enforce permissions themselves (`ctx.can(...)`); the panel hides what the user cannot do but the server
  never trusts that. Use `<resource>:<action>:own` for author-only rules.
- Field names may be nested (`data.title`); read-only fields are shown but never sent.
- Money fields hold integer minor units (or `{ amount, currency }`); the form edits decimals.
- Actions that change state declare `available(row)` so the panel only offers them when valid.

## Don't
- Don't call the admin API from other origins or without the `x-admin-request: 1` header (requests are rejected).
- Don't write per-resource admin pages; extend the `AdminResource` or add a field renderer instead.
- Don't put secrets or full payment data in resource rows: the audit log stores before/after snapshots.
- Don't expose `/admin` in the sitemap or let it be indexed.
