// Componentes base accesibles sobre elementos nativos (sin dependencias de UI). Estilos en ui.css (clases `ui-*`).
import {
  type ButtonHTMLAttributes,
  createElement as h,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

/** Une clases ignorando vacíos. */
export const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'primary' | 'danger' | 'ghost'; size?: 'md' | 'sm'; loading?: boolean };

export function Button({ variant = 'default', size = 'md', loading, className, children, type, ...rest }: ButtonProps): ReactNode {
  return h(
    'button',
    { type: type ?? 'button', className: cx('ui-button', variant !== 'default' && `ui-button--${variant}`, size === 'sm' && 'ui-button--sm', className), 'aria-busy': loading || undefined, ...rest, disabled: rest.disabled || loading },
    loading && h('span', { className: 'ui-spinner', 'aria-hidden': true }),
    children,
  );
}

type FieldWrap = { label: ReactNode; help?: ReactNode; error?: ReactNode; required?: boolean; hideLabel?: boolean };

/** Etiqueta + control + ayuda + error, enlazados con `aria-describedby`. */
export type FieldIds = { id: string; describedBy?: string; invalid: boolean };

export function Field(props: FieldWrap & { render: (ids: FieldIds) => ReactNode }): ReactNode {
  const id = useId();
  const helpId = props.help ? `${id}-help` : undefined;
  const errorId = props.error ? `${id}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined;
  return h(
    'div',
    { className: 'ui-field' },
    h('label', { htmlFor: id, className: cx('ui-field__label', props.hideLabel && 'ui-visually-hidden') }, props.label, props.required && h('span', { 'aria-hidden': true }, ' *')),
    props.render({ id, describedBy, invalid: !!props.error }),
    props.help && h('span', { id: helpId, className: 'ui-field__help' }, props.help),
    props.error && h('span', { id: errorId, className: 'ui-field__error', role: 'alert' }, props.error),
  );
}

export function TextField(props: FieldWrap & Omit<InputHTMLAttributes<HTMLInputElement>, 'id'>): ReactNode {
  const { label, help, error, hideLabel, className, ...input } = props;
  return h(Field, {
    label,
    help,
    error,
    hideLabel,
    required: input.required,
    render: ({ id, describedBy, invalid }: FieldIds) =>
      h('input', { id, 'aria-describedby': describedBy, 'aria-invalid': invalid || undefined, className: cx('ui-input', className), ...input }),
  });
}

export function TextareaField(props: FieldWrap & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'>): ReactNode {
  const { label, help, error, hideLabel, className, ...input } = props;
  return h(Field, {
    label,
    help,
    error,
    hideLabel,
    required: input.required,
    render: ({ id, describedBy, invalid }: FieldIds) =>
      h('textarea', { id, rows: 4, 'aria-describedby': describedBy, 'aria-invalid': invalid || undefined, className: cx('ui-textarea', className), ...input }),
  });
}

export function SelectField(props: FieldWrap & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> & { options: Array<{ value: string; label: string }>; placeholder?: string }): ReactNode {
  const { label, help, error, hideLabel, className, options, placeholder, ...select } = props;
  return h(Field, {
    label,
    help,
    error,
    hideLabel,
    required: select.required,
    render: ({ id, describedBy, invalid }: FieldIds) =>
      h(
        'select',
        { id, 'aria-describedby': describedBy, 'aria-invalid': invalid || undefined, className: cx('ui-select', className), ...select },
        placeholder !== undefined && h('option', { value: '' }, placeholder),
        options.map((o) => h('option', { key: o.value, value: o.value }, o.label)),
      ),
  });
}

export function Checkbox(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: ReactNode }): ReactNode {
  const { label, className, ...input } = props;
  return h('label', { className: cx('ui-checkbox', className) }, h('input', { type: 'checkbox', ...input }), label);
}

export const Card = (p: { children?: ReactNode; className?: string; as?: 'div' | 'section' | 'article' }) => h(p.as ?? 'div', { className: cx('ui-card', p.className) }, p.children);

export const Badge = (p: { children?: ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' }) => h('span', { className: cx('ui-badge', p.tone && p.tone !== 'neutral' && `ui-badge--${p.tone}`) }, p.children);

export const Alert = (p: { children?: ReactNode; tone?: 'info' | 'error' | 'success' | 'warning'; title?: ReactNode }) =>
  h('div', { role: p.tone === 'error' ? 'alert' : 'status', className: cx('ui-alert', p.tone && p.tone !== 'info' && `ui-alert--${p.tone}`) }, p.title && h('strong', null, p.title, ' '), p.children);

export const Skeleton = (p: { width?: string; height?: string }) => h('div', { className: 'ui-skeleton', 'aria-hidden': true, style: { width: p.width ?? '100%', height: p.height ?? '1rem' } });

export const Spinner = (p: { label?: string }) => h('span', { role: 'status' }, h('span', { className: 'ui-spinner', 'aria-hidden': true }), h('span', { className: 'ui-visually-hidden' }, p.label ?? 'Loading'));

export const VisuallyHidden = (p: { children?: ReactNode }) => h('span', { className: 'ui-visually-hidden' }, p.children);

export type Column<T> = { key: string; header: ReactNode; cell: (row: T) => ReactNode; sortable?: boolean };

/** Tabla de datos con encabezados `scope="col"`, orden accesible (`aria-sort`) y estado vacío. */
export function DataTable<T>(p: {
  caption: ReactNode;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  sort?: { key: string; dir: 'asc' | 'desc' };
  onSort?: (key: string) => void;
  empty?: ReactNode;
}): ReactNode {
  return h(
    'table',
    { className: 'ui-table' },
    h('caption', { className: 'ui-visually-hidden' }, p.caption),
    h(
      'thead',
      null,
      h(
        'tr',
        null,
        p.columns.map((c) => {
          const sorted = p.sort?.key === c.key ? (p.sort.dir === 'asc' ? 'ascending' : 'descending') : undefined;
          return h('th', { key: c.key, scope: 'col', 'aria-sort': c.sortable ? (sorted ?? 'none') : undefined }, c.sortable && p.onSort ? h('button', { type: 'button', className: 'ui-button ui-button--ghost ui-button--sm', onClick: () => p.onSort!(c.key) }, c.header) : c.header);
        }),
      ),
    ),
    h(
      'tbody',
      null,
      p.rows.length
        ? p.rows.map((r) => h('tr', { key: p.rowKey(r) }, p.columns.map((c) => h('td', { key: c.key }, c.cell(r)))))
        : h('tr', null, h('td', { colSpan: p.columns.length }, p.empty ?? '—')),
    ),
  );
}

/** Paginación con `nav` etiquetada y página actual marcada con `aria-current`. */
export function Pagination(p: { page: number; pages: number; onPage: (page: number) => void; labels?: { nav?: string; prev?: string; next?: string; page?: (n: number) => string } }): ReactNode {
  if (p.pages <= 1) return null;
  const l = { nav: 'Pagination', prev: 'Previous', next: 'Next', page: (n: number) => `Page ${n}`, ...p.labels };
  const window = [...new Set([1, p.page - 1, p.page, p.page + 1, p.pages])].filter((n) => n >= 1 && n <= p.pages).sort((a, b) => a - b);
  return h(
    'nav',
    { 'aria-label': l.nav, className: 'ui-pagination' },
    h(Button, { size: 'sm', disabled: p.page <= 1, onClick: () => p.onPage(p.page - 1) }, l.prev),
    window.map((n) => h(Button, { key: n, size: 'sm', variant: n === p.page ? 'primary' : 'default', 'aria-current': n === p.page ? 'page' : undefined, 'aria-label': l.page(n), onClick: () => p.onPage(n) }, String(n))),
    h(Button, { size: 'sm', disabled: p.page >= p.pages, onClick: () => p.onPage(p.page + 1) }, l.next),
  );
}

/** Diálogo modal nativo (`<dialog>`): foco atrapado, Escape y backdrop los gestiona el navegador. */
export function Dialog(p: { open: boolean; onClose: () => void; title: ReactNode; children?: ReactNode; footer?: ReactNode }): ReactNode {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (p.open && !d.open) d.showModal?.();
    if (!p.open && d.open) d.close();
  }, [p.open]);
  return h(
    'dialog',
    { ref, className: 'ui-dialog', 'aria-labelledby': titleId, onClose: p.onClose, onCancel: p.onClose },
    h('h2', { id: titleId }, p.title),
    p.children,
    p.footer && h('div', { className: 'ui-dialog__footer' }, p.footer),
  );
}

/** Pestañas WAI-ARIA con flechas izquierda/derecha. */
export function Tabs(p: { label: string; tabs: Array<{ id: string; label: ReactNode; content: ReactNode }>; initial?: string }): ReactNode {
  const base = useId();
  const [active, setActive] = useState(p.initial ?? p.tabs[0]?.id);
  const index = Math.max(0, p.tabs.findIndex((t) => t.id === active));
  const move = (delta: number) => {
    const next = p.tabs[(index + delta + p.tabs.length) % p.tabs.length]!;
    setActive(next.id);
    (globalThis.document?.getElementById(`${base}-tab-${next.id}`) as HTMLElement | null)?.focus();
  };
  return h(
    'div',
    { className: 'ui-tabs' },
    h(
      'div',
      { role: 'tablist', 'aria-label': p.label, className: 'ui-tabs__list' },
      p.tabs.map((t) =>
        h(
          'button',
          {
            key: t.id,
            id: `${base}-tab-${t.id}`,
            role: 'tab',
            type: 'button',
            className: 'ui-tabs__tab',
            'aria-selected': t.id === active,
            'aria-controls': `${base}-panel-${t.id}`,
            tabIndex: t.id === active ? 0 : -1,
            onClick: () => setActive(t.id),
            onKeyDown: (e: { key: string; preventDefault(): void }) => {
              if (e.key === 'ArrowRight') (e.preventDefault(), move(1));
              if (e.key === 'ArrowLeft') (e.preventDefault(), move(-1));
            },
          },
          t.label,
        ),
      ),
    ),
    p.tabs.map((t) => h('div', { key: t.id, id: `${base}-panel-${t.id}`, role: 'tabpanel', 'aria-labelledby': `${base}-tab-${t.id}`, hidden: t.id !== active, tabIndex: 0 }, t.content)),
  );
}

export type Toast = { id: number; tone: 'success' | 'error' | 'info'; message: ReactNode };

/** Región `aria-live` para avisos; usa `useToasts()` para añadirlos. */
export function Toasts(p: { toasts: Toast[]; onDismiss: (id: number) => void; dismissLabel?: string }): ReactNode {
  return h(
    'div',
    { className: 'ui-toasts', 'aria-live': 'polite', role: 'status' },
    p.toasts.map((t) => h('div', { key: t.id, className: cx('ui-alert', t.tone !== 'info' && `ui-alert--${t.tone}`) }, t.message, ' ', h(Button, { size: 'sm', variant: 'ghost', onClick: () => p.onDismiss(t.id), 'aria-label': p.dismissLabel ?? 'Dismiss' }, '×'))),
  );
}

export function useToasts(timeoutMs = 5000) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = (id: number) => setToasts((ts) => ts.filter((t) => t.id !== id));
  const push = (tone: Toast['tone'], message: ReactNode) => {
    const id = Date.now() + Math.random();
    setToasts((ts) => [...ts, { id, tone, message }]);
    if (timeoutMs > 0) setTimeout(() => dismiss(id), timeoutMs);
  };
  return { toasts, push, dismiss };
}
