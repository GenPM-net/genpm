// `<Form formKey>`: formulario HTML que funciona sin JavaScript (POST a /api/forms/<key> y vuelta con 303), con
// honeypot, token de tiempo y casilla de consentimiento. Componente de servidor (async): carga la definición.
import { createElement as h, type ReactNode } from 'react';
import type { z } from 'zod';
import { formTimingToken, honeypotProps, TIMING_FIELD } from '../antispam/index.js';
import { type BuilderField, type FormDefinition, getForm } from './definitions.js';
import { CONSENT_FIELD } from './submit.js';

export const formLabels = {
  submit: 'Send',
  sent: 'Thank you! We have received your message.',
  invalid: 'Please check the highlighted fields.',
  spam: 'Your message could not be sent. Please try again.',
  rate_limited: 'Too many attempts. Please try again later.',
  consent_required: 'Please accept the consent checkbox.',
  not_found: 'This form is not available.',
  required: 'required',
  choose: 'Choose…',
};
export type FormLabels = typeof formLabels;

/** Campos de un formulario de código deducidos de su esquema zod (texto, email, número, select, casilla). */
export function fieldsFromSchema(schema: z.ZodObject): BuilderField[] {
  const out: BuilderField[] = [];
  for (const [name, t] of Object.entries(schema.shape as Record<string, z.ZodType>)) {
    let def = (t as unknown as { def: Record<string, unknown> }).def;
    const required = !(t as z.ZodType).safeParse(undefined).success;
    while (def && ['optional', 'nullable', 'default', 'pipe'].includes(def.type as string))
      def = ((def.innerType ?? def.in) as { def: Record<string, unknown> } | undefined)?.def ?? (undefined as never);
    const checks = (def?.checks as Array<{ _zod?: { def?: { check?: string; maximum?: number } } }> | undefined) ?? [];
    const max = checks.map((c) => c._zod?.def).find((d) => d?.check === 'max_length')?.maximum;
    const label = name.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
    const base = { name, label, required, ...(max && { maxLength: max }) };
    if (def?.type === 'boolean') out.push({ ...base, type: 'checkbox' });
    else if (def?.type === 'number') out.push({ ...base, type: 'number' });
    else if (def?.type === 'enum') out.push({ ...base, type: 'select', options: Object.values(def.entries as Record<string, string>) });
    else if (def?.type === 'string' && def.format === 'email') out.push({ ...base, type: 'email' });
    else out.push({ ...base, type: max && max > 300 ? 'textarea' : 'text' });
  }
  return out;
}

const fieldsOf = (form: FormDefinition) => form.fields ?? fieldsFromSchema(form.schema);

function control(f: BuilderField, id: string, invalid: boolean, describedBy: string | undefined, choose: string): ReactNode {
  const common = { id, name: f.name, required: f.required || undefined, 'aria-invalid': invalid || undefined, 'aria-describedby': describedBy };
  if (f.type === 'textarea') return h('textarea', { ...common, className: 'ui-textarea', rows: 5, maxLength: f.maxLength ?? 5000 });
  if (f.type === 'select')
    return h('select', { ...common, className: 'ui-select', defaultValue: '' }, h('option', { value: '', disabled: f.required }, choose), (f.options ?? []).map((o) => h('option', { key: o, value: o }, o)));
  if (f.type === 'checkbox') return h('input', { ...common, type: 'checkbox' });
  const type = f.type === 'email' ? 'email' : f.type === 'tel' ? 'tel' : f.type === 'number' ? 'number' : 'text';
  const auto = f.type === 'email' ? 'email' : f.type === 'tel' ? 'tel' : /name/i.test(f.name) ? 'name' : undefined;
  return h('input', { ...common, type, className: 'ui-input', maxLength: f.type === 'number' ? undefined : (f.maxLength ?? 300), autoComplete: auto });
}

export type FormProps = {
  formKey: string;
  /** `searchParams` de la página: muestra el resultado del envío sin JavaScript (`form`, `form_status`, `form_errors`). */
  searchParams?: Record<string, string | string[] | undefined>;
  /** Ruta del endpoint (por defecto `/api/forms/<key>`). */
  action?: string;
  labels?: Partial<FormLabels>;
};

/** `<Form formKey="contact" searchParams={await searchParams} />` */
export async function Form(p: FormProps): Promise<ReactNode> {
  const L = { ...formLabels, ...p.labels };
  const form = await getForm(p.formKey);
  if (!form) return null;
  const sp = p.searchParams ?? {};
  const mine = sp.form === p.formKey;
  const status = mine && typeof sp.form_status === 'string' ? sp.form_status : null;
  const bad = new Set(mine && typeof sp.form_errors === 'string' ? sp.form_errors.split(',') : []);
  const id = `form-${p.formKey}`;
  const message = status && status in L ? L[status as keyof FormLabels] : null;
  return h(
    'form',
    { id, className: 'gp-form', method: 'post', action: p.action ?? `/api/forms/${encodeURIComponent(p.formKey)}`, 'aria-label': form.label },
    message && h('p', { role: status === 'sent' ? 'status' : 'alert', className: `ui-alert ${status === 'sent' ? 'ui-alert--success' : 'ui-alert--error'}` }, message as string),
    fieldsOf(form).map((f) => {
      const fid = `${id}-${f.name}`;
      const invalid = bad.has(f.name);
      const errId = invalid ? `${fid}-error` : undefined;
      const label = h('label', { htmlFor: fid, className: 'ui-field__label' }, f.label, f.required && h('span', { 'aria-hidden': true }, ' *'));
      return f.type === 'checkbox'
        ? h('div', { key: f.name, className: 'ui-field ui-checkbox' }, control(f, fid, invalid, errId, L.choose), label, invalid && h('span', { id: errId, className: 'ui-field__error' }, L.invalid))
        : h('div', { key: f.name, className: 'ui-field' }, label, control(f, fid, invalid, errId, L.choose), invalid && h('span', { id: errId, className: 'ui-field__error' }, L.invalid));
    }),
    form.consent &&
      h(
        'div',
        { className: 'ui-field ui-checkbox' },
        h('input', { id: `${id}-consent`, type: 'checkbox', name: CONSENT_FIELD, required: form.consent.required || undefined }),
        h('label', { htmlFor: `${id}-consent` }, form.consent.text),
      ),
    // Trampa para bots: fuera de pantalla, no `type=hidden`.
    h('input', { ...honeypotProps }),
    h('input', { type: 'hidden', name: TIMING_FIELD, value: await formTimingToken() }),
    h('button', { type: 'submit', className: 'ui-button ui-button--primary' }, L.submit),
  );
}
