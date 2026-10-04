// SearchPalette ⌘K (web-ui-spec §6): isla Preact, role="combobox", flechas, Enter abre, ⌘Enter copia el comando.
import { useEffect, useRef, useState } from 'preact/hooks';

type Row = { n: string; v: string; s: string; m: number; vf: number };
type Labels = {
  label: string;
  placeholder: string;
  move: string;
  open: string;
  copy: string;
  none: string;
  publish: string;
  copied: string;
  browseAll: string;
};

export default function SearchPalette(props: { locale: string; prefix: string; labels: Labels }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [idx, setIdx] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const last = useRef<Element | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /INPUT|TEXTAREA|SELECT/.test((document.activeElement as HTMLElement | null)?.tagName ?? '');
      if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && !typing)) {
        e.preventDefault();
        last.current = document.activeElement;
        setOpen((o) => !o);
      } else if (e.key === 'Escape') setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-open-pal]')) {
        last.current = document.activeElement;
        setOpen(true);
      }
    };
    // La caja de búsqueda de la cabecera abre la paleta al enfocarla: resultados mientras escribes, sin Enter.
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target as HTMLInputElement | null;
      if (!el?.matches?.('[data-open-pal-input]')) return;
      // No se le devuelve el foco al cerrar: volvería a abrir la paleta.
      last.current = null;
      setQ(el.value);
      el.blur();
      setOpen(true);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onClick);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onClick);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, []);

  useEffect(() => {
    if (open) input.current?.focus();
    else (last.current as HTMLElement | null)?.focus?.();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    const h = setTimeout(async () => {
      try {
        const res = await fetch(`/search.json?q=${encodeURIComponent(q.trim())}&limit=8`, { signal: ctrl.signal });
        const j = (await res.json()) as { r: Row[] };
        setRows(j.r ?? []);
        setIdx(0);
      } catch {
        /* abortado o sin red */
      }
    }, 200);
    return () => {
      clearTimeout(h);
      ctrl.abort();
    };
  }, [q, open]);

  if (!open) return null;
  const go = (r: Row) => {
    location.href = `${props.prefix}/p/${r.n}`;
  };
  const onKey = async (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIdx((i) => Math.min(i + 1, rows.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && rows[idx]) {
      e.preventDefault();
      if (e.metaKey || e.ctrlKey) {
        await navigator.clipboard?.writeText(`genpm add ${rows[idx].n}`).catch(() => undefined);
        setOpen(false);
      } else go(rows[idx]);
    }
  };
  return (
    // Cierra solo si el clic EMPIEZA en el fondo: el clic que abre la paleta desde la caja de la cabecera termina
    // (mouseup/click) encima del fondo recién pintado y, con onClick, la cerraba al instante.
    <div class="scrim" onPointerDown={(e) => (e.target as HTMLElement).classList.contains('scrim') && setOpen(false)}>
      <div class="pal" role="dialog" aria-modal="true" aria-label={props.labels.label}>
        <div class="in">
          <svg class="ico" aria-hidden="true">
            <use href="#i-search" />
          </svg>
          <input
            ref={input}
            value={q}
            onInput={(e) => setQ((e.target as HTMLInputElement).value)}
            onKeyDown={onKey}
            placeholder={props.labels.placeholder}
            role="combobox"
            aria-expanded="true"
            aria-controls="plist"
            aria-activedescendant={rows[idx] ? `pal-${idx}` : undefined}
            autocomplete="off"
          />
          <span class="kbd">esc</span>
        </div>
        <div id="plist" class="opts" role="listbox">
          {rows.length ? (
            rows.map((r, i) => (
              <div key={r.n} id={`pal-${i}`} class="opt" role="option" tabIndex={-1} aria-selected={i === idx}>
                <a href={`${props.prefix}/p/${r.n}`}>
                  <b>{r.n}</b>
                  <span>{r.s}</span>
                </a>
              </div>
            ))
          ) : (
            <div class="none">
              {props.labels.none.replace('{query}', q)} <a href={`${props.prefix}/publish`}>{props.labels.publish}</a>
            </div>
          )}
        </div>
        <a class="all" href={`${props.prefix}/search${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`}>
          {props.labels.browseAll} →
        </a>
        <div class="ft">
          <span>{props.labels.move}</span>
          <span>{props.labels.open}</span>
          <span>{props.labels.copy}</span>
        </div>
      </div>
    </div>
  );
}
