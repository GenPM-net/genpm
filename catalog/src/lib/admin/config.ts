// Configuración del panel: recursos registrados, widgets del dashboard y navegación.
import { z } from 'zod';
import type { AdminContext, AdminField, AdminResource } from '../contracts/index.ts';

export type AdminWidget = {
  name: string;
  title: string;
  permission: string;
  /** Devuelve un número, un texto o filas (`{ label, value, href? }`). */
  load(ctx: AdminContext): Promise<{ value?: string | number; rows?: Array<{ label: string; value: string | number; href?: string }> }>;
};

export type AdminConfig = {
  title: string;
  resources: AdminResource<{ id: string } & Record<string, unknown>>[];
  widgets: AdminWidget[];
};

/** Declara el panel (en `src/genpm/admin.ts`). Los nombres de recurso deben ser únicos. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- cada elemento tiene su propio tipo (recibe y devuelve su fila/datos): ningún tipo común es asignable en ambos sentidos
export function defineAdmin(cfg: { title?: string; resources: Array<AdminResource<any>>; widgets?: AdminWidget[] }): AdminConfig {
  const names = new Set<string>();
  for (const r of cfg.resources) {
    if (!/^[a-z][a-z0-9-_]{0,47}$/.test(r.name)) throw new Error(`invalid admin resource name: ${r.name}`);
    if (names.has(r.name)) throw new Error(`duplicate admin resource: ${r.name}`);
    names.add(r.name);
  }
  return { title: cfg.title ?? 'Admin', resources: cfg.resources, widgets: cfg.widgets ?? [] };
}

/** Campos deducidos de un esquema zod objeto (para entradas de acciones o recursos sin `fields`). */
export function fieldsFromZod(schema: unknown): AdminField[] {
  const shape = (schema as { shape?: Record<string, z.ZodType> })?.shape;
  if (!shape) return [];
  const type = (t: z.ZodType): AdminField['type'] => {
    const def = (t as unknown as { def?: { type?: string; innerType?: z.ZodType; format?: string } }).def;
    const k = def?.type;
    if ((k === 'optional' || k === 'nullable' || k === 'default' || k === 'pipe') && def?.innerType) return type(def.innerType);
    if (k === 'number') return 'number';
    if (k === 'boolean') return 'boolean';
    if (k === 'date') return 'datetime';
    if (k === 'enum') return 'select';
    if (k === 'string') return def?.format === 'url' ? 'url' : def?.format === 'email' ? 'email' : 'text';
    return 'json';
  };
  return Object.entries(shape).map(([name, t]) => {
    const def = (t as unknown as { def?: { type?: string; entries?: Record<string, string> } }).def;
    return {
      name,
      label: name.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()),
      type: type(t),
      required: !(t as z.ZodType).safeParse(undefined).success,
      ...(def?.type === 'enum' && def.entries && { options: Object.values(def.entries).map((v) => ({ value: String(v), label: String(v) })) }),
    };
  });
}
