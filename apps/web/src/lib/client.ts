// JS mínimo del sitio (sin framework): copiar, tabs ARIA, menú móvil, tema, runner y analítica sin cookies.
function toast(msg: string) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.querySelector('span')!.textContent = msg;
  t.hidden = false;
  clearTimeout((toast as unknown as { h?: number }).h);
  (toast as unknown as { h?: number }).h = window.setTimeout(() => (t.hidden = true), 1800);
}

export function track(event: string, data: Record<string, string> = {}) {
  try {
    navigator.sendBeacon?.('/e', JSON.stringify({ event, ...data, path: location.pathname }));
  } catch {
    /* la analítica nunca rompe la página */
  }
}

async function copy(text: string, btn: HTMLElement | null, okLabel: string) {
  try {
    await navigator.clipboard.writeText(text);
    if (btn) {
      const orig = btn.dataset.l ?? btn.textContent ?? '';
      btn.dataset.l = orig;
      btn.textContent = document.documentElement.dataset.copied ?? 'Copied';
      btn.classList.add('ok');
      setTimeout(() => {
        btn.textContent = orig;
        btn.classList.remove('ok');
      }, 1500);
    }
    toast(okLabel);
  } catch {
    toast(document.documentElement.dataset.copyfail ?? '⌘C');
  }
}

function wireTabs(root: ParentNode) {
  root.querySelectorAll<HTMLElement>('[data-tabs]').forEach((box) => {
    const tabs = [...box.querySelectorAll<HTMLElement>('[role=tab]')].filter((t) => t.closest('[data-tabs]') === box);
    const select = (tab: HTMLElement, push = false) => {
      for (const t of tabs) {
        t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
        t.tabIndex = t === tab ? 0 : -1;
      }
      box.querySelectorAll<HTMLElement>('[data-panel]').forEach((p) => {
        if (p.closest('[data-tabs]') === box) p.hidden = p.dataset.panel !== tab.dataset.tab;
      });
      if (push && box.dataset.tabs === 'hash') {
        history.replaceState(null, '', `#${tab.dataset.tab}`);
        track('tab_view', { tab: tab.dataset.tab ?? '' });
      }
    };
    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => select(tab, true));
      tab.addEventListener('keydown', (e) => {
        const d =
          e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        const n = tabs[(i + d + tabs.length) % tabs.length]!;
        n.focus();
        select(n, true);
      });
    });
    if (box.dataset.tabs === 'hash' && location.hash) {
      const target = tabs.find((t) => t.dataset.tab === location.hash.slice(1));
      if (target) select(target);
    }
  });
}

/** Instalador del binario según el sistema (portada y /docs/install): macOS/Linux por defecto, Windows si se detecta. */
function selectOs(box: Element | null, os: string) {
  if (!box) return;
  for (const b of box.querySelectorAll('[data-os]'))
    b.setAttribute('aria-pressed', String((b as HTMLElement).dataset.os === os));
  for (const p of box.querySelectorAll<HTMLElement>('[data-os-panel]')) p.hidden = p.dataset.osPanel !== os;
}

export function initSite() {
  const root = document.documentElement;
  document.addEventListener('click', (e) => {
    const el = e.target as HTMLElement;
    const b = el.closest<HTMLElement>('[data-copy]');
    if (b) {
      e.preventDefault();
      const src = document.getElementById(b.dataset.copy!);
      if (src) void copy(src.textContent ?? '', b, root.dataset.copiedtoast ?? 'Copied');
      if (b.dataset.event) track(b.dataset.event, { pkg: b.dataset.pkgname ?? '' });
      return;
    }
    const sha = el.closest<HTMLElement>('[data-copysha]');
    if (sha) void copy(sha.dataset.copysha!, null, root.dataset.shacopied ?? 'Copied');
    const run = el.closest<HTMLElement>('[data-run]');
    if (run) {
      for (const x of run.parentElement?.querySelectorAll('[data-run]') ?? [])
        x.setAttribute('aria-pressed', x === run ? 'true' : 'false');
      const code = document.querySelector<HTMLElement>('code[data-pkg]');
      if (code)
        code.textContent = run.dataset.run
          ? `${run.dataset.run} @genpm-net/cli add ${code.dataset.pkg}`
          : `genpm add ${code.dataset.pkg}`;
    }
    const os = el.closest<HTMLElement>('[data-os]');
    if (os) selectOs(os.closest('[data-os-box]'), os.dataset.os!);
    if (el.closest('[data-menu]')) {
      const sheet = document.getElementById('sheet')!;
      sheet.hidden = !sheet.hidden;
      el.closest('[data-menu]')!.setAttribute('aria-expanded', String(!sheet.hidden));
    }
    if (el.closest('[data-theme-toggle]')) {
      const dark = root.dataset.theme !== 'dark';
      root.dataset.theme = dark ? 'dark' : 'light';
      try {
        localStorage.setItem('genpm-theme', dark ? 'dark' : 'light');
      } catch {
        /* sin almacenamiento: solo esta visita */
      }
    }
    if (el.closest('[data-dismiss-lang]')) {
      el.closest<HTMLElement>('[data-langbar]')!.hidden = true;
      try {
        localStorage.setItem('genpm-lang-dismissed', '1');
      } catch {
        /* nada */
      }
    }
  });
  if (/Windows/.test(navigator.userAgent))
    for (const box of document.querySelectorAll('[data-os-box]')) selectOs(box, 'windows');
  const bar = document.querySelector<HTMLElement>('[data-langbar]');
  if (bar) {
    try {
      bar.hidden = localStorage.getItem('genpm-lang-dismissed') === '1';
    } catch {
      bar.hidden = false;
    }
  }
  wireTabs(document);
}
