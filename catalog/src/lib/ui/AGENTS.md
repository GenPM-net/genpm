# @core/ui — rules for AI agents

## Purpose
Small accessible component set for React built on native elements (no UI library): `Button`, `TextField`,
`TextareaField`, `SelectField`, `Checkbox`, `Field` (label + help + error wiring), `DataTable` (with `aria-sort`),
`Pagination`, `Tabs` (WAI-ARIA, arrow keys), `Dialog` (native `<dialog>`), `Alert`, `Badge`, `Card`, `Toasts`,
`Spinner`, `Skeleton`. Styling lives in `ui.css` as CSS variables (light/dark, WCAG AA contrast) and `ui-*` classes.
Used by @core/admin, @core/blocks and the kits.

## Map
- `index.ts` — all components and `cx()`.
- `components.ts` — implementation. `ui.css` — tokens and styles.

## Integration
1. Import the stylesheet once in the root layout: `import '@/components/ui/ui.css'` and add `className="ui-root"` to `<body>`.
2. Use components: `<TextField label="Email" type="email" required error={errors.email} />`, `<Button variant="primary" loading={saving}>Save</Button>`.
3. Theme: change `--ui-*` variables in your CSS; force a theme with `<html data-theme="dark">`.
4. Verify: tab through a form; every control has a visible focus ring and a label.

## Conventions
- Every field gets a visible label (use `hideLabel` only when context makes it obvious); errors go in `error`, not in placeholders.
- Interactive elements are real `<button>`/`<a>`/inputs; don't add click handlers to `<div>`.
- Pass translated `labels` to `Pagination` and `dismissLabel` to `Toasts`.

## Don't
- Don't lower contrast below 4.5:1 when changing tokens, or remove the focus outline.
- Don't add app-specific components here; keep them in your app or kit.
