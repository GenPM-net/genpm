'use client';
// Campo `richText` del panel con el editor de @core/rich-text.
import type { FieldRendererProps } from '@/lib/admin/client';
import { type Doc, emptyDoc } from '@/lib/rich-text';
import { RichTextEditor } from '@/lib/rich-text/editor';

export function RichTextField(p: FieldRendererProps) {
  const value = p.value && typeof p.value === 'object' ? (p.value as Doc) : emptyDoc();
  return (
    <div className="ui-field" role="group" aria-label={p.field.label}>
      <span className="ui-field__label">{p.field.label}</span>
      <RichTextEditor value={value} onChange={p.onChange} editable={!p.disabled} />
      {p.error && (
        <span className="ui-field__error" role="alert">
          {p.error}
        </span>
      )}
    </div>
  );
}
