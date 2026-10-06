// @vitest-environment happy-dom
import axe from 'axe-core';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { act, createElement as h, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { Alert, Badge, Button, Card, Checkbox, DataTable, Pagination, SelectField, Tabs, TextareaField, TextField } from './index.ts';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLElement;

async function render(node: ReactNode) {
  container = document.createElement('main');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(node));
  return root;
}
afterEach(() => container?.remove());

async function violations() {
  // El contraste se comprueba aparte (happy-dom no calcula estilos); el resto de reglas, con axe.
  const r = await axe.run(container, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
  return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(' | ')}`);
}

describe('accessibility (axe)', () => {
  it('the harness does catch problems (control)', async () => {
    await render(h('div', null, h('input', { type: 'text' }), h('button', { type: 'button' })));
    expect((await violations()).map((v) => v.split(':')[0])).toEqual(expect.arrayContaining(['label', 'button-name']));
  });

  it('a form with every field type has no violations and links help/errors', async () => {
    await render(
      h(
        'form',
        null,
        h(TextField, { label: 'Name', required: true, help: 'As on your ID' }),
        h(TextField, { label: 'Email', type: 'email', error: 'Invalid email' }),
        h(TextareaField, { label: 'Message' }),
        h(SelectField, { label: 'Size', options: [{ value: 's', label: 'Small' }], placeholder: 'Choose…' }),
        h(Checkbox, { label: 'I accept' }),
        h(Button, { type: 'submit', variant: 'primary' }, 'Send'),
      ),
    );
    expect(await violations()).toEqual([]);
    const email = container.querySelector('input[type=email]')!;
    expect(email.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(email.getAttribute('aria-describedby')!)?.textContent).toBe('Invalid email');
    expect(container.querySelector(`label[for="${container.querySelector('input')!.id}"]`)?.textContent).toBe('Name *');
  });

  it('table, pagination, tabs, alerts, badges and cards have no violations', async () => {
    let page = 2;
    await render(
      h(
        'div',
        null,
        h(DataTable<{ id: string; name: string }>, { caption: 'Products', columns: [{ key: 'name', header: 'Name', cell: (r) => r.name, sortable: true }], rows: [{ id: '1', name: 'Mug' }], rowKey: (r) => r.id, sort: { key: 'name', dir: 'asc' }, onSort: () => {} }),
        h(Pagination, { page, pages: 5, onPage: (p) => (page = p) }),
        h(Tabs, { label: 'Product', tabs: [{ id: 'a', label: 'Details', content: 'A' }, { id: 'b', label: 'Reviews', content: 'B' }] }),
        h(Alert, { tone: 'error', title: 'Error' }, 'Something failed'),
        h(Badge, { tone: 'success' }, 'Paid'),
        h(Card, { as: 'section' }, h('h2', null, 'Card')),
      ),
    );
    expect(await violations()).toEqual([]);
    expect(container.querySelector('th')?.getAttribute('aria-sort')).toBe('ascending');
    expect(container.querySelector('[aria-current="page"]')?.textContent).toBe('2');
  });
});

describe('behaviour', () => {
  it('tabs move with arrow keys and show one panel', async () => {
    await render(h(Tabs, { label: 'T', tabs: [{ id: 'a', label: 'A', content: 'Panel A' }, { id: 'b', label: 'B', content: 'Panel B' }] }));
    const tabs = container.querySelectorAll('[role=tab]');
    await act(async () => tabs[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    expect(container.querySelector('[role=tab][aria-selected=true]')?.textContent).toBe('B');
    const visible = [...container.querySelectorAll('[role=tabpanel]')].filter((p) => !p.hasAttribute('hidden'));
    expect(visible.map((p) => p.textContent)).toEqual(['Panel B']);
  });

  it('loading buttons are busy and disabled', async () => {
    await render(h(Button, { loading: true }, 'Save'));
    const b = container.querySelector('button')!;
    expect([b.getAttribute('aria-busy'), b.hasAttribute('disabled'), b.getAttribute('type')]).toEqual(['true', true, 'button']);
  });
});

describe('design tokens', () => {
  const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'ui.css'), 'utf8');
  const block = (selector: string) => {
    const i = css.indexOf(`${selector} {`);
    const vars = new Map<string, string>();
    for (const m of css.slice(i, css.indexOf('}', i)).matchAll(/(--ui-[\w-]+):\s*(#[0-9a-f]{6})/g)) vars.set(m[1]!, m[2]!);
    return vars;
  };
  const lum = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  const ratio = (a: string, b: string) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x! + 0.05) / (y! + 0.05);
  };
  it.each([[':root'], [':root[data-theme="dark"]']])('%s meets WCAG AA (4.5:1) for text pairs', (sel) => {
    const v = block(sel);
    const pairs: Array<[string, string]> = [['--ui-text', '--ui-bg'], ['--ui-text', '--ui-surface'], ['--ui-muted', '--ui-bg'], ['--ui-primary-text', '--ui-primary'], ['--ui-danger', '--ui-bg'], ['--ui-success', '--ui-bg'], ['--ui-warning', '--ui-bg']];
    for (const [fg, bg] of pairs) expect(ratio(v.get(fg)!, v.get(bg)!), `${sel} ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
  });
});
