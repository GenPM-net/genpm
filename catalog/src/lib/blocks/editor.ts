'use client';
// Campo `blocks` para @core/admin: lista ordenable de bloques con añadir, duplicar, ocultar, mover y quitar.
// Uso: en el servidor `const meta = blockMeta(blocks)` (registro de `src/genpm/blocks.ts`) y en el cliente
// `<AdminApp renderers={{ blocks: blocksRenderer(meta) }} />`: al navegador solo viajan tipos, campos y valores iniciales.
import { createElement as h, type ReactNode, useId, useState } from 'react';
import { type FieldRenderer, type FieldRendererProps, FieldControl, getPath, setPath } from '../admin/client.ts';
import { Badge, Button, SelectField } from '../ui/index.ts';
import { type BlockInstance, type BlockMeta, newBlockId } from './define.ts';

export const editorLabels = {
  add: 'Add block',
  type: 'Block type',
  moveUp: 'Move up',
  moveDown: 'Move down',
  duplicate: 'Duplicate',
  remove: 'Remove',
  hide: 'Hide',
  show: 'Show',
  hidden: 'Hidden',
  edit: 'Edit',
  collapse: 'Collapse',
  unknown: 'Unknown block',
  empty: 'No blocks yet.',
};

function BlocksEditor(p: FieldRendererProps & { meta: BlockMeta[]; text: typeof editorLabels }): ReactNode {
  const blocks = Array.isArray(p.value) ? (p.value as BlockInstance[]) : [];
  const defs = p.meta;
  const get = (type: string) => defs.find((d) => d.type === type);
  const [type, setType] = useState(defs[0]?.type ?? '');
  const [open, setOpen] = useState<string | null>(null);
  const legendId = useId();
  const set = (next: BlockInstance[]) => p.onChange(next);
  const update = (i: number, patch: Partial<BlockInstance>) => set(blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...blocks];
    const [b] = next.splice(i, 1);
    next.splice(i + d, 0, b!);
    set(next);
  };
  const L = p.text;
  return h(
    'fieldset',
    { className: 'ui-field admin-list', 'aria-labelledby': legendId },
    h('legend', { id: legendId, className: 'ui-field__label' }, p.field.label),
    !blocks.length && h('p', { className: 'ui-field__help' }, L.empty),
    h(
      'ol',
      { className: 'blk-editor' },
      blocks.map((b, i) => {
        const def = get(b.type);
        const name = `${i + 1}. ${def?.label ?? L.unknown}`;
        const isOpen = open === b.id;
        return h(
          'li',
          { key: b.id, className: 'admin-list__item' },
          h(
            'div',
            { className: 'admin-list__tools' },
            h(Button, { size: 'sm', variant: 'ghost', 'aria-expanded': isOpen, onClick: () => setOpen(isOpen ? null : b.id) }, h('strong', null, name)),
            b.hidden && h(Badge, { tone: 'warning' }, L.hidden),
            h(Button, { size: 'sm', disabled: p.disabled || i === 0, onClick: () => move(i, -1), 'aria-label': `${L.moveUp}: ${name}` }, '↑'),
            h(Button, { size: 'sm', disabled: p.disabled || i === blocks.length - 1, onClick: () => move(i, 1), 'aria-label': `${L.moveDown}: ${name}` }, '↓'),
            h(Button, { size: 'sm', disabled: p.disabled, onClick: () => update(i, { hidden: !b.hidden }), 'aria-label': `${b.hidden ? L.show : L.hide}: ${name}` }, b.hidden ? L.show : L.hide),
            h(
              Button,
              {
                size: 'sm',
                disabled: p.disabled,
                'aria-label': `${L.duplicate}: ${name}`,
                onClick: () => set([...blocks.slice(0, i + 1), { ...structuredClone(b), id: newBlockId() }, ...blocks.slice(i + 1)]),
              },
              L.duplicate,
            ),
            h(Button, { size: 'sm', variant: 'danger', disabled: p.disabled, onClick: () => set(blocks.filter((_, j) => j !== i)), 'aria-label': `${L.remove}: ${name}` }, L.remove),
          ),
          isOpen &&
            def &&
            def.fields.map((f) =>
              h(FieldControl, {
                key: f.name,
                field: f,
                value: getPath(b.data, f.name),
                onChange: (v) => update(i, { data: setPath(b.data, f.name, v) }),
                disabled: p.disabled,
                api: p.api,
                labels: p.labels,
                renderers: p.renderers,
              }),
            ),
        );
      }),
    ),
    defs.length > 0 &&
      h(
        'div',
        { className: 'admin-list__tools' },
        h(SelectField, { label: L.type, options: defs.map((d) => ({ value: d.type, label: d.label })), value: type, disabled: p.disabled, onChange: (e) => setType(e.currentTarget.value) }),
        h(
          Button,
          {
            disabled: p.disabled || !type,
            onClick: () => {
              const def = get(type);
              if (!def) return;
              const b: BlockInstance = { id: newBlockId(), type, data: structuredClone(def.defaults) };
              set([...blocks, b]);
              setOpen(b.id);
            },
          },
          L.add,
        ),
      ),
    p.error && h('span', { className: 'ui-field__error', role: 'alert' }, p.error),
  );
}

/** Renderizador del tipo de campo `blocks` para `AdminApp`; los campos internos usan los demás `renderers` de la app. */
export function blocksRenderer(meta: BlockMeta[], opts: { labels?: Partial<typeof editorLabels> } = {}): FieldRenderer {
  const text = { ...editorLabels, ...opts.labels };
  return (props) => h(BlocksEditor, { ...props, meta, text });
}
