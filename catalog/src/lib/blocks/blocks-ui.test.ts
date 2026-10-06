// @vitest-environment happy-dom
import axe from 'axe-core';
import { act, createElement as h, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createAdminApi, defaultLabels } from '../admin/client.js';
import { allBlocks, allMedia } from './__fixtures__/page.js';
import { type BlockInstance, blockMeta, coreBlocks, createBlockRegistry } from './index.js';
import { blocksRenderer } from './editor.js';
import { RenderBlocks } from './render.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const registry = createBlockRegistry(coreBlocks);
let container: HTMLElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('main');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function violations() {
  const r = await axe.run(container, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
  return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(' | ')}`);
}

describe('accessibility', () => {
  it('a page with the 15 blocks has no axe violations and a sound heading order', async () => {
    await act(async () => root.render(h(RenderBlocks, { blocks: allBlocks, registry, media: allMedia, renderForm: () => h('p', null, 'form'), onSkip: () => {} })));
    expect(await violations()).toEqual([]);
    const levels = [...container.querySelectorAll('h1,h2,h3,h4')].map((e) => Number(e.tagName[1]));
    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i++) expect(levels[i]! - levels[i - 1]!).toBeLessThanOrEqual(1);
  });
});

describe('blocks editor', () => {
  const api = createAdminApi('/api/admin', async () => Response.json({ rows: [], total: 0 }));
  const render = blocksRenderer(JSON.parse(JSON.stringify(blockMeta(registry)))); // como llega al cliente
  let current: BlockInstance[] = [];
  function Harness() {
    const [value, setValue] = useState<BlockInstance[]>([]);
    current = value;
    return h('form', null, render({ field: { name: 'blocks', label: 'Page blocks', type: 'blocks' }, value, onChange: (v) => setValue(v as BlockInstance[]), disabled: false, api, labels: defaultLabels }));
  }
  const click = async (el: Element | undefined | null) => {
    expect(el).toBeTruthy();
    await act(async () => (el as HTMLElement).click());
  };
  const button = (text: string) => [...container.querySelectorAll('button')].find((b) => b.textContent === text || b.getAttribute('aria-label')?.startsWith(text));
  const choose = async (type: string) => {
    const select = [...container.querySelectorAll<HTMLSelectElement>('select')].at(-1)!; // el selector de tipo va al final
    await act(async () => {
      select.value = type;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
  };

  it('adds, edits, duplicates, hides, reorders and removes blocks', async () => {
    await act(async () => root.render(h(Harness)));
    expect(container.textContent).toContain('No blocks yet.');

    await choose('cta');
    await click(button('Add block'));
    expect(current).toMatchObject([{ type: 'cta', data: { title: 'Ready?' } }]);
    expect(await violations()).toEqual([]);

    const title = container.querySelector<HTMLInputElement>('input[type=text]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(title, 'Join us');
      title.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(current[0]!.data.title).toBe('Join us');

    await choose('faq');
    await click(button('Add block'));
    // La lista de preguntas del bloque FAQ usa el campo `list` del admin.
    expect(container.querySelector('fieldset fieldset legend')?.textContent).toBe('Questions');
    await click(button('Add item'));
    expect((current[1]!.data.items as unknown[]).length).toBe(2);
    expect(await violations()).toEqual([]);

    await click(button('Duplicate: 1.'));
    expect(current.map((b) => b.type)).toEqual(['cta', 'cta', 'faq']);
    expect(current[1]!.id).not.toBe(current[0]!.id);
    expect(current[1]!.data.title).toBe('Join us');

    await click(button('Hide: 2.'));
    expect(current[1]!.hidden).toBe(true);
    await click(button('Move down: 1.'));
    expect(current.map((b) => `${b.type}${b.hidden ? '-hidden' : ''}`)).toEqual(['cta-hidden', 'cta', 'faq']);
    await click(button('Remove: 1.'));
    expect(current.map((b) => b.type)).toEqual(['cta', 'faq']);
    // La pregunta añadida está vacía: el servidor la rechaza con la ruta exacta del campo.
    const r = registry.schema.safeParse(current);
    expect(r.error?.issues.map((i) => i.path.join('.'))).toEqual(['1.data.items.1.question', '1.data.items.1.answer']);
  });
});
