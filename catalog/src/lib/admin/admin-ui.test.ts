// @vitest-environment happy-dom
// happy-dom aplica las reglas del navegador (no deja poner `cookie` en un Request): el usuario se inyecta con `getUser`.
import axe from 'axe-core';
import { act, createElement as h } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AdminApp } from './client.ts';
import { admin, notes, ORIGIN, owner, setup } from './__fixtures__/admin.ts';
import { handleAdminApi } from './server.ts';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
beforeEach(setup);

describe('AdminApp (happy-dom + axe)', () => {
  let container: HTMLElement;
  let root: Root;
  const requests: string[] = [];
  // fetch que pasa por el handler real. happy-dom, como un navegador, descarta `Origin` en un Request construido a mano,
  // así que se entrega al handler un objeto con la misma forma y el origen que pondría el navegador.
  const fetcher: typeof fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    const url = `${ORIGIN}${String(input)}`;
    const method = init?.method ?? 'GET';
    requests.push(`${method} ${new URL(url).pathname}`);
    const req = {
      url,
      method,
      headers: { get: (k: string) => (k.toLowerCase() === 'origin' ? ORIGIN : headers.get(k)) },
      json: async () => JSON.parse(String(init?.body ?? 'null')),
    } as unknown as Request;
    const u = owner();
    inflight++;
    try {
      return await handleAdminApi(req, admin, { getUser: async () => ({ id: u.id, email: null, name: 'Owner' }) });
    } finally {
      inflight--;
    }
  };
  let inflight = 0;
  // Espera a que no queden peticiones en vuelo (con Postgres real tardan más que con PGlite): una que siga viva
  // tras el test pisaría el esquema del siguiente.
  const settle = async () => {
    for (let i = 0, idle = 0; i < 400 && idle < 10; i++) {
      await act(async () => new Promise((r) => setTimeout(r, 5)));
      idle = inflight === 0 ? idle + 1 : 0;
    }
  };
  const violations = async () => {
    const r = await axe.run(container, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
    return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(' | ')}`);
  };
  const click = async (el: Element | null | undefined) => {
    expect(el).toBeTruthy();
    await act(async () => (el as HTMLElement).click());
    await settle();
  };

  beforeEach(() => {
    requests.length = 0;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('navigates dashboard → list → edit, saves and runs an action without a11y violations', async () => {
    await act(async () => root.render(h(AdminApp, { fetch: fetcher, path: '' })));
    await settle();
    expect(container.querySelector('nav[aria-label="Admin navigation"]')?.textContent).toContain('Notes');
    expect(container.querySelector('.admin-widget__value')?.textContent).toBe('2');
    expect(await violations()).toEqual([]);

    await click([...container.querySelectorAll('nav a')].find((a) => a.textContent === 'Notes'));
    expect(location.pathname).toBe('/admin/notes');
    const cells = [...container.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent));
    expect(cells).toEqual([
      ['Alpha', 'Alpha', '19.99', 'Draft'],
      ['Beta', 'Beta', '5.00', 'Published'],
    ]);
    expect(await violations()).toEqual([]);

    await click(container.querySelector('tbody a'));
    expect(container.querySelector('h1')?.textContent).toBe('Alpha');
    expect(await violations()).toEqual([]);
    const title = container.querySelector<HTMLInputElement>('form input:not([inputmode])')!;
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      set.call(title, 'Alpha 2');
      title.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await click(container.querySelector('form button[type=submit]'));
    expect(requests).toContain('PUT /api/admin/notes/n1');
    expect(notes().get('n1')!.title).toBe('Alpha 2');
    expect(notes().get('n1')!.price).toBe(1999);

    await click([...container.querySelectorAll('.admin-actions button')].find((b) => b.textContent === 'Publish'));
    await click([...container.querySelectorAll('dialog button')].find((b) => b.textContent === 'Confirm'));
    expect(notes().get('n1')!.status).toBe('published');
    expect(container.querySelector('.admin-actions')).toBeNull();
  });

  it('shows field errors returned by the server', async () => {
    await act(async () => root.render(h(AdminApp, { fetch: fetcher, path: 'notes/new' })));
    await settle();
    expect(container.querySelector('h1')?.textContent).toBe('New note');
    await click(container.querySelector('form button[type=submit]'));
    expect(requests).toContain('POST /api/admin/notes');
    const invalid = container.querySelector('input[aria-invalid="true"]');
    expect(invalid).toBeTruthy();
    expect(document.getElementById(invalid!.getAttribute('aria-describedby')!.split(' ').pop()!)?.getAttribute('role')).toBe('alert');
    expect(await violations()).toEqual([]);
  });
});
