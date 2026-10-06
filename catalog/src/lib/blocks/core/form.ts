import { z } from 'zod';
import { createElement as h } from 'react';
import { defineBlock } from '../define.ts';
import { optText, Section, text } from '../parts.ts';

export const form = defineBlock({
  type: 'form',
  label: 'Form',
  icon: 'form',
  schema: z.object({ title: optText(160), intro: optText(400), formKey: text(60) }),
  fields: [
    { name: 'title', label: 'Title', type: 'text' },
    { name: 'intro', label: 'Introduction', type: 'textarea' },
    { name: 'formKey', label: 'Form', type: 'text', required: true, help: 'Key of a form defined with @core/forms (e.g. "contact").' },
  ],
  defaults: () => ({ formKey: 'contact' }),
  Component: ({ data, ctx }) => {
    const rendered = ctx.renderForm?.(data.formKey);
    if (!rendered) return null;
    return h(Section, { id: ctx.id, block: 'form', title: data.title, intro: data.intro, ctx, label: 'Form' }, rendered);
  },
});
