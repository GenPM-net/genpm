// Definición de formularios: en código (`defineForm`) o desde el panel (colección `forms` de @core/content).
import { z } from 'zod';
import { defineCollection, getEntry } from '../content/index.js';

export type ConsentConfig = { required: boolean; version: string; text: string };

export type FormDefinition = {
  key: string;
  label: string;
  schema: z.ZodObject;
  /** Emails del equipo que reciben cada envío. Por defecto `FORMS_NOTIFY_TO`. */
  notify?: string[];
  /** Campo con el email de quien envía: se usa como reply-to y para la respuesta automática. */
  emailField?: string;
  autoReply?: { subject: string; text: string };
  /** Webhook https que recibe cada envío firmado con `FORMS_WEBHOOK_SECRET`. */
  webhook?: string;
  consent?: ConsentConfig;
  /** Campos para pintar el formulario (`<Form>`). Los de código se deducen del esquema si faltan. */
  fields?: BuilderField[];
};

const KEY_RE = /^[a-z][a-z0-9-]{0,47}$/;
const registry = new Map<string, FormDefinition>();

export function defineForm(def: FormDefinition): FormDefinition {
  if (!KEY_RE.test(def.key)) throw new Error(`invalid form key: ${def.key}`);
  if (def.webhook && !def.webhook.startsWith('https://')) throw new Error('form webhooks must use https');
  registry.set(def.key, def);
  return def;
}

/** Solo tests. */
export const clearForms = () => registry.clear();

// Formularios creados desde el panel: los campos se describen como datos y se convierten a zod al usarlos.
const FieldType = z.enum(['text', 'email', 'tel', 'textarea', 'number', 'select', 'checkbox']);
const BuilderField = z.object({
  name: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/),
  label: z.string().min(1).max(120),
  type: FieldType,
  required: z.boolean().default(false),
  options: z.array(z.string().min(1).max(120)).max(50).optional(),
  maxLength: z.number().int().min(1).max(10_000).optional(),
});
export type BuilderField = z.infer<typeof BuilderField>;

export const FormBuilderSchema = z.object({
  label: z.string().min(1).max(120),
  fields: z.array(BuilderField).min(1).max(30),
  notify: z.array(z.email()).max(10).default([]),
  emailField: z.string().optional(),
  autoReply: z.object({ subject: z.string().max(200), text: z.string().max(5000) }).optional(),
  webhook: z.url().refine((u) => u.startsWith('https://'), 'https only').optional(),
  consent: z.object({ required: z.boolean(), version: z.string().max(40), text: z.string().max(2000) }).optional(),
});

export const forms = defineCollection('forms', {
  schema: FormBuilderSchema,
  label: { singular: 'Form', plural: 'Forms' },
  titleField: 'label',
  localized: false,
});

export function schemaFromFields(fields: BuilderField[]): z.ZodObject {
  const shape: Record<string, z.ZodType> = {};
  for (const f of fields) {
    let t: z.ZodType;
    const max = f.maxLength ?? (f.type === 'textarea' ? 5000 : 300);
    if (f.type === 'email') t = z.email().max(254);
    else if (f.type === 'number') t = z.coerce.number();
    else if (f.type === 'checkbox') t = z.preprocess((v) => v === true || v === 'on' || v === 'true', z.boolean());
    else if (f.type === 'select' && f.options?.length) t = z.enum(f.options as [string, ...string[]]);
    else t = z.string().trim().max(max);
    if (f.type === 'checkbox') shape[f.name] = f.required ? t.refine((v) => v === true, 'Required') : t;
    else if (f.required) shape[f.name] = f.type === 'number' || f.type === 'select' || f.type === 'email' ? t : (t as z.ZodString).min(1, 'Required');
    else shape[f.name] = z.preprocess((v) => (v === '' ? undefined : v), t.optional());
  }
  return z.object(shape);
}

/** Definición por clave: primero las de código, luego las publicadas desde el panel. */
export async function getForm(key: string): Promise<FormDefinition | null> {
  const coded = registry.get(key);
  if (coded) return coded;
  if (!KEY_RE.test(key)) return null;
  const entry = await getEntry<z.infer<typeof FormBuilderSchema>>('forms', key);
  if (!entry) return null;
  const d = entry.data;
  return { key, label: d.label, schema: schemaFromFields(d.fields), notify: d.notify, emailField: d.emailField, autoReply: d.autoReply, webhook: d.webhook, consent: d.consent, fields: d.fields };
}
