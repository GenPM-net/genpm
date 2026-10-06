'use client';
// Panel generado a partir de `GET /schema`: navegación, dashboard, listas, formularios y acciones. Sin pantallas por
// recurso: lo que un paquete describe con `AdminResource` aparece aquí. Campos especiales (richText, media, blocks…)
// se inyectan con `renderers` para que este paquete no dependa de editores concretos.
import { createElement as h, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import type { AdminField } from '../contracts/index.js';
import { Alert, Badge, Button, Card, Checkbox, type Column, DataTable, Dialog, Field, Pagination, SelectField, Skeleton, TextareaField, TextField, Toasts, useToasts } from '../ui/index.js';
import { ADMIN_HEADER } from './constants.js';

export type SchemaAction = { name: string; label: string; confirm: boolean; fields: AdminField[] };
export type SchemaResource = {
  name: string;
  label: { singular: string; plural: string };
  group: string | null;
  icon: string | null;
  fields: AdminField[];
  can: { create: boolean; update: boolean; delete: boolean };
  actions: SchemaAction[];
};
export type AdminSchema = { title: string; user: { id: string; email: string | null; name: string | null }; resources: SchemaResource[] };
type Row = { id: string; _title?: string; _actions?: string[]; _links?: Array<{ label: string; href: string }> } & Record<string, unknown>;

/** Props que recibe un renderizador de campo propio. */
export type FieldRendererProps = {
  field: AdminField;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  disabled: boolean;
  api: AdminApi;
  /** Textos del panel y renderizadores propios (para campos anidados). */
  labels: AdminLabels;
  renderers?: Record<string, FieldRenderer> | undefined;
};
export type FieldRenderer = (props: FieldRendererProps) => ReactNode;

/** Textos visibles del panel (inglés por defecto; la app los traduce con su i18n). */
export const defaultLabels = {
  dashboard: 'Dashboard',
  navigation: 'Admin navigation',
  search: 'Search',
  create: 'New',
  edit: 'Edit',
  save: 'Save',
  cancel: 'Cancel',
  delete: 'Delete',
  confirm: 'Confirm',
  back: 'Back to list',
  empty: 'Nothing here yet.',
  loading: 'Loading',
  saved: 'Saved',
  deleted: 'Deleted',
  done: 'Done',
  forbidden: 'You do not have permission to do this.',
  unauthorized: 'Your session has expired. Sign in again.',
  error: 'Something went wrong. Try again.',
  invalid: 'Check the highlighted fields.',
  notFound: 'Not found.',
  confirmDelete: (name: string) => `Delete “${name}”? This cannot be undone.`,
  confirmAction: (label: string, name: string) => `${label}: “${name}”?`,
  results: (n: number) => `${n} results`,
  yes: 'Yes',
  no: 'No',
  none: '—',
  selectPlaceholder: 'Choose…',
  invalidJson: 'Invalid JSON',
  addItem: 'Add item',
  removeItem: 'Remove',
  moveUp: 'Move up',
  moveDown: 'Move down',
  item: (n: number) => `Item ${n}`,
};
export type AdminLabels = typeof defaultLabels;

export class AdminApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public issues: Array<{ path: string; message: string }> = [],
  ) {
    super(code);
  }
}

/** Cliente del API JSON (también lo usan los renderizadores de relaciones y medios). */
export function createAdminApi(base = '/api/admin', fetcher: typeof fetch = (...a) => fetch(...a)) {
  const call = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    const res = await fetcher(`${base}${path}`, {
      method,
      credentials: 'same-origin',
      headers: { accept: 'application/json', ...(method !== 'GET' && { [ADMIN_HEADER]: '1', 'content-type': 'application/json' }) },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
    if (res.status === 204) return undefined as T;
    const data = (await res.json().catch(() => ({}))) as { error?: string; issues?: Array<{ path: string; message: string }> };
    if (!res.ok) throw new AdminApiError(res.status, data.error ?? 'error', data.issues ?? []);
    return data as T;
  };
  const enc = encodeURIComponent;
  return {
    schema: () => call<AdminSchema>('GET', '/schema'),
    widgets: () => call<{ widgets: Array<{ name: string; title: string; value?: string | number; rows?: Array<{ label: string; value: string | number; href?: string }> }> }>('GET', '/widgets'),
    list: (resource: string, q: { page?: number; pageSize?: number; q?: string; sort?: string; dir?: 'asc' | 'desc'; filters?: Record<string, string> } = {}) => {
      const p = new URLSearchParams();
      if (q.page) p.set('page', String(q.page));
      if (q.pageSize) p.set('pageSize', String(q.pageSize));
      if (q.q) p.set('q', q.q);
      if (q.sort) p.set('sort', q.sort);
      if (q.dir) p.set('dir', q.dir);
      for (const [k, v] of Object.entries(q.filters ?? {})) p.set(`f.${k}`, v);
      const qs = p.toString();
      return call<{ rows: Row[]; total: number }>('GET', `/${enc(resource)}${qs ? `?${qs}` : ''}`);
    },
    get: (resource: string, id: string) => call<Row>('GET', `/${enc(resource)}/${enc(id)}`),
    create: (resource: string, input: unknown) => call<Row>('POST', `/${enc(resource)}`, input),
    update: (resource: string, id: string, input: unknown) => call<Row>('PUT', `/${enc(resource)}/${enc(id)}`, input),
    remove: (resource: string, id: string) => call<void>('DELETE', `/${enc(resource)}/${enc(id)}`),
    action: (resource: string, id: string, action: string, input: unknown) => call<Row>('POST', `/${enc(resource)}/${enc(id)}/actions/${enc(action)}`, input ?? {}),
  };
}
export type AdminApi = ReturnType<typeof createAdminApi>;

// --- valores anidados (`data.title`) --------------------------------------------------------------------------------

export function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj);
}

export function setPath<T extends Record<string, unknown>>(obj: T, path: string, value: unknown): T {
  const [head, ...rest] = path.split('.') as [string, ...string[]];
  if (head === '__proto__' || head === 'constructor' || head === 'prototype') return obj;
  if (!rest.length) return { ...obj, [head]: value };
  const child = obj[head];
  return { ...obj, [head]: setPath(child && typeof child === 'object' ? (child as Record<string, unknown>) : {}, rest.join('.'), value) };
}

/** Valores del formulario a partir de un registro: solo los campos editables declarados. */
export function formValues(fields: AdminField[], row: Record<string, unknown> | null): Record<string, unknown> {
  let out: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.readOnly) continue;
    const v = row ? getPath(row, f.name) : undefined;
    out = setPath(out, f.name, v ?? (f.type === 'boolean' ? false : f.many || f.type === 'list' ? [] : undefined));
  }
  return out;
}

/** Importe en unidades menores ↔ texto decimal (2 decimales por defecto). */
export const moneyToInput = (minor: unknown, digits = 2) => (typeof minor === 'number' ? (minor / 10 ** digits).toFixed(digits) : '');
export function inputToMoney(text: string, digits = 2): number | undefined {
  const t = text.trim().replace(',', '.');
  if (!t) return undefined;
  if (!/^-?\d+(\.\d+)?$/.test(t)) return Number.NaN;
  return Math.round(Number(t) * 10 ** digits);
}

/** Texto para una celda de la lista. */
export function displayValue(field: AdminField, value: unknown, labels: AdminLabels = defaultLabels): string {
  if (value === null || value === undefined || value === '') return labels.none;
  if (field.type === 'boolean') return value ? labels.yes : labels.no;
  if (field.type === 'money') {
    const m = typeof value === 'number' ? { amount: value, currency: '' } : (value as { amount?: number; currency?: string });
    return typeof m.amount === 'number' ? `${moneyToInput(m.amount)}${m.currency ? ` ${m.currency}` : ''}` : labels.none;
  }
  if (field.type === 'select') return field.options?.find((o) => o.value === value)?.label ?? String(value);
  if (field.type === 'date' || field.type === 'datetime') {
    const d = new Date(String(value));
    return Number.isNaN(d.getTime()) ? String(value) : field.type === 'date' ? d.toISOString().slice(0, 10) : d.toISOString().slice(0, 16).replace('T', ' ');
  }
  if (Array.isArray(value)) return value.length ? value.map((v) => (typeof v === 'object' ? labels.none : String(v))).join(', ') : labels.none;
  if (typeof value === 'object') return '{…}';
  const s = String(value);
  return s.length > 80 ? `${s.slice(0, 79)}…` : s;
}

// --- renderizadores por defecto -------------------------------------------------------------------------------------

const toLocalInput = (v: unknown, withTime: boolean) => {
  if (!v) return '';
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return withTime ? `${date}T${pad(d.getHours())}:${pad(d.getMinutes())}` : date;
};

function JsonField(p: FieldRendererProps): ReactNode {
  const [text, setText] = useState(() => (p.value === undefined ? '' : JSON.stringify(p.value, null, 2)));
  const [bad, setBad] = useState(false);
  return h(TextareaField, {
    label: p.field.label,
    help: p.field.help,
    required: p.field.required,
    error: bad ? p.labels.invalidJson : p.error,
    rows: 8,
    value: text,
    disabled: p.disabled,
    spellCheck: false,
    onChange: (e) => {
      const t = e.currentTarget.value;
      setText(t);
      if (!t.trim()) {
        setBad(false);
        p.onChange(undefined);
        return;
      }
      try {
        p.onChange(JSON.parse(t));
        setBad(false);
      } catch {
        setBad(true);
      }
    },
  });
}

function RelationField(p: FieldRendererProps & { resource: string }): ReactNode {
  const [options, setOptions] = useState<Array<{ value: string; label: string }> | null>(null);
  useEffect(() => {
    let live = true;
    p.api
      .list(p.resource, { pageSize: 100 })
      .then((r) => live && setOptions(r.rows.map((row) => ({ value: row.id, label: row._title ?? row.id }))))
      .catch(() => live && setOptions([]));
    return () => {
      live = false;
    };
  }, [p.api, p.resource]);
  if (!options) return h(Field, { label: p.field.label, render: () => h(Skeleton, { height: '2.5rem' }) });
  if (p.field.many) {
    const selected = new Set(Array.isArray(p.value) ? (p.value as string[]) : []);
    return h(
      'fieldset',
      { className: 'ui-field' },
      h('legend', { className: 'ui-field__label' }, p.field.label),
      options.map((o) =>
        h(Checkbox, {
          key: o.value,
          label: o.label,
          checked: selected.has(o.value),
          disabled: p.disabled,
          onChange: (e) => {
            const next = new Set(selected);
            if (e.currentTarget.checked) next.add(o.value);
            else next.delete(o.value);
            p.onChange([...next]);
          },
        }),
      ),
      p.error && h('span', { className: 'ui-field__error', role: 'alert' }, p.error),
    );
  }
  return h(SelectField, {
    label: p.field.label,
    help: p.field.help,
    error: p.error,
    required: p.field.required,
    disabled: p.disabled,
    options,
    placeholder: p.labels.selectPlaceholder,
    value: typeof p.value === 'string' ? p.value : '',
    onChange: (e) => p.onChange(e.currentTarget.value || null),
  });
}

/** Lista ordenable de objetos (`type: 'list'` con `fields`): añadir, quitar y reordenar. */
function ListField(p: FieldRendererProps): ReactNode {
  const items = Array.isArray(p.value) ? (p.value as Array<Record<string, unknown>>) : [];
  const sub = p.field.fields ?? [];
  const set = (next: Array<Record<string, unknown>>) => p.onChange(next);
  const move = (i: number, d: -1 | 1) => {
    const next = [...items];
    const [it] = next.splice(i, 1);
    next.splice(i + d, 0, it!);
    set(next);
  };
  return h(
    'fieldset',
    { className: 'ui-field admin-list' },
    h('legend', { className: 'ui-field__label' }, p.field.label),
    p.field.help && h('p', { className: 'ui-field__help' }, p.field.help),
    items.map((item, i) =>
      h(
        'fieldset',
        { key: i, className: 'admin-list__item' },
        h('legend', null, p.labels.item(i + 1)),
        sub.map((f) =>
          h(FieldControl, {
            key: f.name,
            field: f,
            value: getPath(item, f.name),
            onChange: (v) => set(items.map((it, j) => (j === i ? setPath(it, f.name, v) : it))),
            disabled: p.disabled,
            api: p.api,
            labels: p.labels,
            renderers: p.renderers,
          }),
        ),
        h(
          'div',
          { className: 'admin-list__tools' },
          h(Button, { size: 'sm', disabled: p.disabled || i === 0, onClick: () => move(i, -1), 'aria-label': `${p.labels.moveUp}: ${p.labels.item(i + 1)}` }, '↑'),
          h(Button, { size: 'sm', disabled: p.disabled || i === items.length - 1, onClick: () => move(i, 1), 'aria-label': `${p.labels.moveDown}: ${p.labels.item(i + 1)}` }, '↓'),
          h(Button, { size: 'sm', variant: 'danger', disabled: p.disabled, onClick: () => set(items.filter((_, j) => j !== i)) }, `${p.labels.removeItem} ${p.labels.item(i + 1).toLowerCase()}`),
        ),
      ),
    ),
    h(Button, { size: 'sm', disabled: p.disabled, onClick: () => set([...items, formValues(sub, null)]) }, p.labels.addItem),
    p.error && h('span', { className: 'ui-field__error', role: 'alert' }, p.error),
  );
}

/** Control para un campo: renderizador propio si existe; si no, uno nativo según el tipo. */
export function FieldControl(p: FieldRendererProps): ReactNode {
  const { field, value, onChange, error, disabled, labels } = p;
  const custom = p.renderers?.[field.type];
  if (custom) return custom(p);
  const common = { label: field.label, help: field.help, error, required: field.required, disabled };
  switch (field.type) {
    case 'boolean':
      return h(Checkbox, { label: field.label, checked: !!value, disabled, onChange: (e) => onChange(e.currentTarget.checked) });
    case 'textarea':
      return h(TextareaField, { ...common, rows: 4, value: typeof value === 'string' ? value : '', onChange: (e) => onChange(e.currentTarget.value) });
    case 'number':
      return h(TextField, { ...common, type: 'number', inputMode: 'decimal', value: typeof value === 'number' ? String(value) : '', onChange: (e) => onChange(e.currentTarget.value === '' ? undefined : Number(e.currentTarget.value)) });
    case 'money': {
      const isObj = value !== null && typeof value === 'object';
      const amount = isObj ? (value as { amount?: number }).amount : value;
      const currency = isObj ? (value as { currency?: string }).currency : undefined;
      return h(TextField, {
        ...common,
        label: currency ? `${field.label} (${currency})` : field.label,
        inputMode: 'decimal',
        defaultValue: moneyToInput(amount),
        onChange: (e) => {
          const minor = inputToMoney(e.currentTarget.value);
          onChange(isObj ? { ...(value as object), amount: minor } : minor);
        },
      });
    }
    case 'date':
    case 'datetime':
      return h(TextField, {
        ...common,
        type: field.type === 'date' ? 'date' : 'datetime-local',
        value: toLocalInput(value, field.type === 'datetime'),
        onChange: (e) => {
          const v = e.currentTarget.value;
          onChange(v ? (field.type === 'date' ? v : new Date(v).toISOString()) : null);
        },
      });
    case 'select':
      return h(SelectField, { ...common, options: field.options ?? [], placeholder: labels.selectPlaceholder, value: value == null ? '' : String(value), onChange: (e) => onChange(e.currentTarget.value || undefined) });
    case 'relation':
      return field.relationTo ? h(RelationField, { ...p, resource: field.relationTo }) : h(JsonField, p);
    case 'media':
      return h(RelationField, { ...p, resource: field.relationTo ?? 'media' });
    case 'list':
      return h(ListField, p);
    case 'richText':
    case 'blocks':
    case 'json':
      return h(JsonField, p);
    default:
      return h(TextField, {
        ...common,
        type: field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text',
        value: typeof value === 'string' ? value : value == null ? '' : String(value),
        onChange: (e) => onChange(e.currentTarget.value === '' && !field.required ? undefined : e.currentTarget.value),
      });
  }
}

// --- navegación ---------------------------------------------------------------------------------------------------

export type AdminRoute = { view: 'dashboard' } | { view: 'list'; resource: string } | { view: 'new'; resource: string } | { view: 'edit'; resource: string; id: string };

export function parseRoute(path: string): AdminRoute {
  const [resource, id] = path.split('/').filter(Boolean).map(decodeURIComponent);
  if (!resource) return { view: 'dashboard' };
  if (!id) return { view: 'list', resource };
  if (id === 'new') return { view: 'new', resource };
  return { view: 'edit', resource, id };
}

export function routePath(route: AdminRoute): string {
  if (route.view === 'dashboard') return '';
  const r = encodeURIComponent(route.resource);
  return route.view === 'list' ? `/${r}` : route.view === 'new' ? `/${r}/new` : `/${r}/${encodeURIComponent(route.id)}`;
}

// --- vistas -------------------------------------------------------------------------------------------------------

type Ctx = {
  api: AdminApi;
  labels: AdminLabels;
  renderers?: Record<string, FieldRenderer>;
  go: (r: AdminRoute) => void;
  href: (r: AdminRoute) => string;
  notify: (tone: 'success' | 'error' | 'info', message: ReactNode) => void;
};

const errorText = (e: unknown, l: AdminLabels) =>
  e instanceof AdminApiError ? (e.status === 401 ? l.unauthorized : e.status === 403 ? l.forbidden : e.status === 404 ? l.notFound : e.status === 422 ? l.invalid : l.error) : l.error;

const link = (c: Ctx, route: AdminRoute, children: ReactNode, extra: Record<string, unknown> = {}) =>
  h(
    'a',
    {
      href: c.href(route),
      onClick: (e: MouseEvent) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        c.go(route);
      },
      ...extra,
    },
    children,
  );

function Dashboard(p: { c: Ctx; schema: AdminSchema }): ReactNode {
  const [widgets, setWidgets] = useState<Awaited<ReturnType<AdminApi['widgets']>>['widgets'] | null>(null);
  useEffect(() => {
    p.c.api
      .widgets()
      .then((w) => setWidgets(w.widgets))
      .catch(() => setWidgets([]));
  }, [p.c.api]);
  return h(
    'section',
    { 'aria-labelledby': 'admin-h1' },
    h('h1', { id: 'admin-h1' }, p.c.labels.dashboard),
    !widgets
      ? h(Skeleton, { height: '6rem' })
      : h(
          'div',
          { className: 'admin-widgets' },
          widgets.map((w) =>
            h(
              Card,
              { key: w.name, as: 'section' },
              h('h2', null, w.title),
              w.value !== undefined && h('p', { className: 'admin-widget__value' }, String(w.value)),
              w.rows && h('ul', null, w.rows.map((r, i) => h('li', { key: i }, r.href ? h('a', { href: r.href }, r.label) : r.label, ' ', h(Badge, null, String(r.value))))),
            ),
          ),
          !widgets.length &&
            h(
              'ul',
              null,
              p.schema.resources.map((r) => h('li', { key: r.name }, link(p.c, { view: 'list', resource: r.name }, r.label.plural))),
            ),
        ),
  );
}

function ListView(p: { c: Ctx; resource: SchemaResource }): ReactNode {
  const { c, resource } = p;
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | undefined>();
  const [data, setData] = useState<{ rows: Row[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 20;
  useEffect(() => {
    let live = true;
    setError(null);
    c.api
      .list(resource.name, { page, pageSize, ...(query && { q: query }), ...(sort && { sort: sort.key, dir: sort.dir }) })
      .then((d) => live && setData(d))
      .catch((e) => live && setError(errorText(e, c.labels)));
    return () => {
      live = false;
    };
  }, [c.api, c.labels, resource.name, page, query, sort]);

  const listFields = resource.fields.filter((f) => f.list);
  const columns: Column<Row>[] = [
    { key: '_title', header: resource.label.singular, cell: (row) => link(c, { view: 'edit', resource: resource.name, id: row.id }, row._title ?? row.id) },
    ...listFields.map((f) => ({ key: f.name, header: f.label, sortable: !f.name.includes('.'), cell: (row: Row) => displayValue(f, getPath(row, f.name), c.labels) })),
  ];
  return h(
    'section',
    { 'aria-labelledby': 'admin-h1' },
    h(
      'header',
      { className: 'admin-header' },
      h('h1', { id: 'admin-h1' }, resource.label.plural),
      resource.can.create && link(c, { view: 'new', resource: resource.name }, `${c.labels.create} ${resource.label.singular.toLowerCase()}`, { className: 'ui-button ui-button--primary' }),
    ),
    h(
      'form',
      {
        role: 'search',
        className: 'admin-search',
        onSubmit: (e: Event) => {
          e.preventDefault();
          setPage(1);
          setQuery(q.trim());
        },
      },
      h(TextField, { label: c.labels.search, hideLabel: true, type: 'search', placeholder: c.labels.search, value: q, onChange: (e) => setQ(e.currentTarget.value) }),
      h(Button, { type: 'submit' }, c.labels.search),
    ),
    error && h(Alert, { tone: 'error' }, error),
    !data && !error && h(Skeleton, { height: '10rem' }),
    data &&
      h(
        'div',
        null,
        h('p', { 'aria-live': 'polite', className: 'admin-count' }, c.labels.results(data.total)),
        h(DataTable<Row>, {
          caption: resource.label.plural,
          columns,
          rows: data.rows,
          rowKey: (r) => r.id,
          ...(sort && { sort }),
          onSort: (key) => {
            setPage(1);
            setSort((s) => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
          },
          empty: c.labels.empty,
        }),
        h(Pagination, { page, pages: Math.ceil(data.total / pageSize), onPage: setPage }),
      ),
  );
}

function issuesByField(e: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (e instanceof AdminApiError) for (const i of e.issues) out[i.path || '_'] ??= i.message;
  return out;
}

function ActionButton(p: { c: Ctx; resource: SchemaResource; action: SchemaAction; row: Row; onDone: (row: Row) => void }): ReactNode {
  const { c, action, row } = p;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const needsDialog = action.confirm || action.fields.length > 0;
  const run = async () => {
    setBusy(true);
    setErrors({});
    try {
      const next = await c.api.action(p.resource.name, row.id, action.name, input);
      setOpen(false);
      c.notify('success', `${action.label}: ${c.labels.done}`);
      p.onDone(next);
    } catch (e) {
      setErrors(issuesByField(e));
      c.notify('error', errorText(e, c.labels));
    } finally {
      setBusy(false);
    }
  };
  return h(
    'span',
    null,
    h(Button, { loading: busy && !open, onClick: () => (needsDialog ? setOpen(true) : void run()) }, action.label),
    needsDialog &&
      h(
        Dialog,
        {
          open,
          onClose: () => setOpen(false),
          title: action.label,
          footer: h('span', null, h(Button, { onClick: () => setOpen(false) }, c.labels.cancel), ' ', h(Button, { variant: 'primary', loading: busy, onClick: () => void run() }, c.labels.confirm)),
        },
        h('p', null, c.labels.confirmAction(action.label, row._title ?? row.id)),
        action.fields.map((f) =>
          h(FieldControl, { key: f.name, field: f, value: getPath(input, f.name), onChange: (v) => setInput((s) => setPath(s, f.name, v)), error: errors[f.name], disabled: busy, api: c.api, labels: c.labels, renderers: c.renderers }),
        ),
      ),
  );
}

function EditView(p: { c: Ctx; resource: SchemaResource; id?: string }): ReactNode {
  const { c, resource, id } = p;
  const [row, setRow] = useState<Row | null>(null);
  const [values, setValues] = useState<Record<string, unknown> | null>(id ? null : formValues(resource.fields, null));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!id) return;
    let live = true;
    c.api
      .get(resource.name, id)
      .then((r) => {
        if (!live) return;
        setRow(r);
        setValues(formValues(resource.fields, r));
      })
      .catch((e) => live && setLoadError(errorText(e, c.labels)));
    return () => {
      live = false;
    };
  }, [c.api, c.labels, resource, id]);

  const editable = id ? resource.can.update : resource.can.create;
  const submit = async (e: Event) => {
    e.preventDefault();
    if (!values || !editable) return;
    setBusy(true);
    setErrors({});
    try {
      const saved = id ? await c.api.update(resource.name, id, values) : await c.api.create(resource.name, values);
      c.notify('success', c.labels.saved);
      if (!id) c.go({ view: 'edit', resource: resource.name, id: saved.id });
      else {
        const fresh = await c.api.get(resource.name, id);
        setRow(fresh);
        setValues(formValues(resource.fields, fresh));
        setVersion((v) => v + 1);
      }
    } catch (err) {
      setErrors(issuesByField(err));
      c.notify('error', errorText(err, c.labels));
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!id) return;
    setBusy(true);
    try {
      await c.api.remove(resource.name, id);
      c.notify('success', c.labels.deleted);
      c.go({ view: 'list', resource: resource.name });
    } catch (err) {
      c.notify('error', errorText(err, c.labels));
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  if (loadError) return h(Alert, { tone: 'error' }, loadError);
  if (!values) return h(Skeleton, { height: '20rem' });
  const title = id ? (row?._title ?? id) : `${c.labels.create} ${resource.label.singular.toLowerCase()}`;
  const available = new Set(row?._actions ?? []);
  return h(
    'section',
    { 'aria-labelledby': 'admin-h1' },
    link(c, { view: 'list', resource: resource.name }, `← ${c.labels.back}`),
    h(
      'header',
      { className: 'admin-header' },
      h('h1', { id: 'admin-h1' }, title),
      row?._links?.length ? h('div', { className: 'admin-actions' }, row._links.map((l) => h('a', { key: l.href, href: l.href, target: '_blank', rel: 'noopener noreferrer', className: 'ui-button ui-button--sm' }, l.label))) : null,
    ),
    row &&
      resource.actions.some((a) => available.has(a.name)) &&
      h(
        'div',
        { className: 'admin-actions', role: 'group', 'aria-label': resource.label.singular },
        resource.actions
          .filter((a) => available.has(a.name))
          .map((a) =>
            h(ActionButton, {
              key: a.name,
              c,
              resource,
              action: a,
              row,
              onDone: () => {
                c.api.get(resource.name, row.id).then((fresh) => {
                  setRow(fresh);
                  setValues(formValues(resource.fields, fresh));
                  setVersion((v) => v + 1);
                });
              },
            }),
          ),
      ),
    errors._ && h(Alert, { tone: 'error' }, errors._),
    h(
      'form',
      { key: version, className: 'admin-form', noValidate: true, onSubmit: submit },
      resource.fields.map((f) =>
        f.readOnly
          ? row && h('div', { key: f.name, className: 'ui-field' }, h('span', { className: 'ui-field__label' }, f.label), h('span', null, displayValue(f, getPath(row, f.name), c.labels)))
          : h(FieldControl, {
              key: f.name,
              field: f,
              value: getPath(values, f.name),
              onChange: (v) => setValues((s) => setPath(s ?? {}, f.name, v)),
              error: errors[f.name],
              disabled: busy || !editable,
              api: c.api,
              labels: c.labels,
              renderers: c.renderers,
            }),
      ),
      h(
        'div',
        { className: 'admin-form__footer' },
        editable && h(Button, { type: 'submit', variant: 'primary', loading: busy }, c.labels.save),
        id && resource.can.delete && h(Button, { variant: 'danger', disabled: busy, onClick: () => setConfirmDelete(true) }, c.labels.delete),
      ),
    ),
    id &&
      resource.can.delete &&
      h(
        Dialog,
        {
          open: confirmDelete,
          onClose: () => setConfirmDelete(false),
          title: c.labels.delete,
          footer: h('span', null, h(Button, { onClick: () => setConfirmDelete(false) }, c.labels.cancel), ' ', h(Button, { variant: 'danger', loading: busy, onClick: () => void remove() }, c.labels.delete)),
        },
        h('p', null, c.labels.confirmDelete(title)),
      ),
  );
}

/**
 * Panel completo. Montarlo en una ruta comodín (`app/admin/[[...path]]/page.tsx`) y pasar la ruta actual:
 * `<AdminApp basePath="/admin" path={params.path?.join('/') ?? ''} />`.
 */
export function AdminApp(p: {
  basePath?: string;
  apiBase?: string;
  path?: string;
  renderers?: Record<string, FieldRenderer>;
  labels?: Partial<AdminLabels>;
  fetch?: typeof fetch;
}): ReactNode {
  const basePath = (p.basePath ?? '/admin').replace(/\/+$/, '');
  const api = useMemo(() => createAdminApi(p.apiBase ?? '/api/admin', p.fetch), [p.apiBase, p.fetch]);
  const labels = useMemo(() => ({ ...defaultLabels, ...p.labels }), [p.labels]);
  const [schema, setSchema] = useState<AdminSchema | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [route, setRoute] = useState<AdminRoute>(() => parseRoute(p.path ?? ''));
  const { toasts, push, dismiss } = useToasts();

  useEffect(() => {
    api
      .schema()
      .then(setSchema)
      .catch((e) => setError(errorText(e, labels)));
  }, [api, labels]);
  useEffect(() => {
    const onPop = () => setRoute(parseRoute(location.pathname.slice(basePath.length)));
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, [basePath]);

  const href = useCallback((r: AdminRoute) => `${basePath}${routePath(r)}` || '/', [basePath]);
  const go = useCallback(
    (r: AdminRoute) => {
      history.pushState(null, '', href(r));
      setRoute(r);
      document.getElementById('admin-main')?.focus();
    },
    [href],
  );
  const c: Ctx = { api, labels, renderers: p.renderers, go, href, notify: (tone, message) => push(tone, message) };

  if (error) return h('main', { className: 'admin' }, h(Alert, { tone: 'error' }, error));
  if (!schema) return h('main', { className: 'admin' }, h(Skeleton, { height: '20rem' }));

  const groups = new Map<string, SchemaResource[]>();
  for (const r of schema.resources) groups.set(r.group ?? '', [...(groups.get(r.group ?? '') ?? []), r]);
  const current = route.view === 'dashboard' ? null : schema.resources.find((r) => r.name === route.resource);
  const active = current?.name;

  let body: ReactNode;
  if (route.view === 'dashboard') body = h(Dashboard, { c, schema });
  else if (!current) body = h(Alert, { tone: 'error' }, labels.notFound);
  else if (route.view === 'list') body = h(ListView, { key: current.name, c, resource: current });
  else body = h(EditView, { key: `${current.name}/${route.view === 'edit' ? route.id : 'new'}`, c, resource: current, ...(route.view === 'edit' && { id: route.id }) });

  return h(
    'div',
    { className: 'admin' },
    h(
      'nav',
      { 'aria-label': labels.navigation, className: 'admin-nav' },
      h('p', { className: 'admin-nav__title' }, schema.title),
      h('ul', null, h('li', null, link(c, { view: 'dashboard' }, labels.dashboard, route.view === 'dashboard' ? { 'aria-current': 'page' } : {}))),
      [...groups].map(([group, resources]) =>
        h(
          'div',
          { key: group || '_' },
          group && h('p', { className: 'admin-nav__group' }, group),
          h('ul', null, resources.map((r) => h('li', { key: r.name }, link(c, { view: 'list', resource: r.name }, r.label.plural, active === r.name ? { 'aria-current': 'page' } : {})))),
        ),
      ),
    ),
    h('main', { id: 'admin-main', tabIndex: -1, className: 'admin-main' }, body),
    h(Toasts, { toasts, onDismiss: dismiss }),
  );
}
