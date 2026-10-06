'use client';
// Editor (Tiptap) que produce documentos válidos para `RichTextSchema`. Solo en el navegador.
//   <RichTextEditor value={doc} onChange={setDoc} onPickImage={async () => ({ mediaId, alt })} />
// Los estilos los pone la app (clases `.rich-text-editor` y `.ProseMirror`).
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { createElement as h, type ReactNode, useEffect } from 'react';
import { type Doc, isSafeHref, RichTextSchema } from './doc.ts';

export type EditorLabels = Partial<Record<'bold' | 'italic' | 'link' | 'h2' | 'h3' | 'bulletList' | 'orderedList' | 'quote' | 'image' | 'undo' | 'redo' | 'linkPrompt', string>>;

const DEFAULT_LABELS: Required<EditorLabels> = {
  bold: 'Bold', italic: 'Italic', link: 'Link', h2: 'Heading 2', h3: 'Heading 3', bulletList: 'Bullet list',
  orderedList: 'Numbered list', quote: 'Quote', image: 'Image', undo: 'Undo', redo: 'Redo', linkPrompt: 'Link URL (https://…, /page, mailto:…)',
};

const ImageWithMedia = Image.extend({
  addAttributes() {
    return { ...this.parent?.(), mediaId: { default: null } };
  },
});

export function RichTextEditor(props: {
  value: Doc;
  onChange: (doc: Doc) => void;
  /** Abre el selector de medios y devuelve la imagen elegida (o null). */
  onPickImage?: () => Promise<{ mediaId?: string; src?: string; alt: string } | null>;
  labels?: EditorLabels;
  editable?: boolean;
}): ReactNode {
  const labels = { ...DEFAULT_LABELS, ...props.labels };
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false, heading: { levels: [2, 3, 4] } }),
      Link.configure({ openOnClick: false, autolink: true, protocols: ['mailto', 'tel'], isAllowedUri: (url) => isSafeHref(url) }),
      ImageWithMedia,
    ],
    content: props.value,
    editable: props.editable ?? true,
    immediatelyRender: false,
    onUpdate: ({ editor: e }) => {
      // Solo emite documentos válidos (lista blanca); lo que no cumpla se ignora.
      const parsed = RichTextSchema.safeParse(e.getJSON());
      if (parsed.success) props.onChange(parsed.data);
    },
  });
  useEffect(() => {
    if (editor && JSON.stringify(editor.getJSON()) !== JSON.stringify(props.value)) editor.commands.setContent(props.value, { emitUpdate: false });
  }, [editor, props.value]);
  if (!editor) return null;
  const btn = (label: string, active: boolean, run: () => void) =>
    h('button', { key: label, type: 'button', 'aria-label': label, 'aria-pressed': active, onClick: run }, label);
  const chain = () => editor.chain().focus();
  return h(
    'div',
    { className: 'rich-text-editor' },
    h(
      'div',
      { role: 'toolbar', className: 'rich-text-toolbar' },
      btn(labels.bold, editor.isActive('bold'), () => chain().toggleBold().run()),
      btn(labels.italic, editor.isActive('italic'), () => chain().toggleItalic().run()),
      btn(labels.h2, editor.isActive('heading', { level: 2 }), () => chain().toggleHeading({ level: 2 }).run()),
      btn(labels.h3, editor.isActive('heading', { level: 3 }), () => chain().toggleHeading({ level: 3 }).run()),
      btn(labels.bulletList, editor.isActive('bulletList'), () => chain().toggleBulletList().run()),
      btn(labels.orderedList, editor.isActive('orderedList'), () => chain().toggleOrderedList().run()),
      btn(labels.quote, editor.isActive('blockquote'), () => chain().toggleBlockquote().run()),
      btn(labels.link, editor.isActive('link'), () => {
        const href = window.prompt(labels.linkPrompt, editor.getAttributes('link').href ?? '');
        if (href === null) return;
        if (!href) chain().unsetLink().run();
        else if (isSafeHref(href)) chain().extendMarkRange('link').setLink({ href }).run();
      }),
      props.onPickImage &&
        btn(labels.image, false, async () => {
          const img = await props.onPickImage?.();
          if (img) chain().setImage({ src: img.src ?? '', alt: img.alt, ...({ mediaId: img.mediaId ?? null } as object) }).run();
        }),
      btn(labels.undo, false, () => chain().undo().run()),
      btn(labels.redo, false, () => chain().redo().run()),
    ),
    h(EditorContent, { editor }),
  );
}
