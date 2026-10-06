// Definición y registro de bloques. Un bloque = tipo + esquema zod + campos del editor + componente React.
import type { ReactNode } from 'react';
import { z } from 'zod';
import type { AdminField } from '../contracts/index.js';
import type { ResolvedImage } from '../rich-text/index.js';

/** Bloque guardado en el contenido (`data` se valida con el esquema de su tipo). */
export type BlockInstance = { id: string; type: string; hidden?: boolean; data: Record<string, unknown> };

/** Lo que recibe cada componente además de sus datos. */
export type BlockContext = {
  /** Id del bloque (anclas y `aria-labelledby`). */
  id: string;
  /** Nivel del encabezado principal del bloque (2 por defecto; 1 solo para el título de la página). */
  level: 1 | 2 | 3 | 4 | 5 | 6;
  /** Imágenes ya resueltas (`loadBlockMedia`). */
  image: (id: unknown) => ResolvedImage | null;
  /** Hueco para formularios de @core/forms u otros componentes que pone la app. */
  renderForm?: (formKey: string) => ReactNode;
  /** `iframe` solo con consentimiento; `link` por defecto (sin peticiones a terceros). */
  embeds: 'link' | 'iframe';
  siteHost?: string;
  /** Primer bloque visible de la página. */
  first: boolean;
};

export type BlockDefinition<S extends z.ZodType = z.ZodType> = {
  type: string;
  label: string;
  /** Nombre de icono (lo interpreta el editor; opcional). */
  icon?: string;
  schema: S;
  fields: AdminField[];
  /** Datos de un bloque recién añadido en el editor. */
  defaults?: () => Record<string, unknown>;
  /** Este bloque puede ser el título de la página (`h1`): solo uno por página, lo decide `RenderBlocks`. */
  pageTitle?: (data: z.output<S>) => boolean;
  /** Puede ser async (Server Component) para bloques que leen datos: últimos posts, productos… */
  Component: (props: { data: z.output<S>; ctx: BlockContext }) => ReactNode | Promise<ReactNode>;
};

/** Declara un bloque con inferencia de tipos de `data`. */
export const defineBlock = <S extends z.ZodType>(def: BlockDefinition<S>): BlockDefinition<S> => {
  if (!/^[a-z][a-z0-9-]{0,39}$/.test(def.type)) throw new Error(`invalid block type: ${def.type}`);
  return def;
};

export const BlockInstanceSchema = z.object({
  id: z.string().min(1).max(40),
  type: z.string().min(1).max(40),
  hidden: z.boolean().optional(),
  data: z.record(z.string(), z.unknown()),
});

export type BlockRegistry = {
  get(type: string): BlockDefinition | undefined;
  list(): BlockDefinition[];
  /** Esquema zod para un campo de contenido con bloques (valida cada bloque con su tipo y aplica defaults). */
  schema: z.ZodType<BlockInstance[], unknown>;
  /** Campo `blocks` para el admin. */
  field(name: string, label: string, opts?: Partial<AdminField>): AdminField;
};

/** Registro único de la app (`src/genpm/blocks.ts`): bloques base + los que añaden kits y paquetes. */
export function createBlockRegistry(defs: BlockDefinition<any>[], opts: { max?: number } = {}): BlockRegistry {
  const map = new Map<string, BlockDefinition>();
  for (const d of defs) {
    if (map.has(d.type)) throw new Error(`duplicate block type: ${d.type}`);
    map.set(d.type, d as BlockDefinition);
  }
  const schema = z
    .array(BlockInstanceSchema)
    .max(opts.max ?? 100)
    .transform((blocks, ctx) => {
      const ids = new Set<string>();
      return blocks.map((b, i) => {
        if (ids.has(b.id)) ctx.addIssue({ code: 'custom', path: [i, 'id'], message: `duplicate block id ${b.id}` });
        ids.add(b.id);
        const def = map.get(b.type);
        if (!def) {
          ctx.addIssue({ code: 'custom', path: [i, 'type'], message: `unknown block type ${b.type}` });
          return b;
        }
        const r = def.schema.safeParse(b.data);
        if (!r.success) {
          for (const issue of r.error.issues) ctx.addIssue({ code: 'custom', path: [i, 'data', ...issue.path.map((p) => (typeof p === 'symbol' ? String(p) : p))], message: issue.message });
          return b;
        }
        return { ...b, data: r.data as Record<string, unknown> };
      });
    }) as unknown as z.ZodType<BlockInstance[], unknown>;
  return {
    get: (t) => map.get(t),
    list: () => [...map.values()],
    schema,
    field: (name, label, extra = {}) => ({ name, label, type: 'blocks', ...extra }),
  };
}

/** Id corto para un bloque nuevo. */
export const newBlockId = () => Math.random().toString(36).slice(2, 10);

/** Ids de @core/media usados por los bloques (campos `media`, también dentro de listas). */
export function collectMediaIds(blocks: BlockInstance[], registry: BlockRegistry): string[] {
  const out = new Set<string>();
  const walk = (fields: AdminField[], data: unknown) => {
    if (!data || typeof data !== 'object') return;
    for (const f of fields) {
      const v = (data as Record<string, unknown>)[f.name];
      if (f.type === 'media') for (const id of Array.isArray(v) ? v : [v]) if (typeof id === 'string' && id) out.add(id);
      if (f.type === 'list' && Array.isArray(v)) for (const item of v) walk(f.fields ?? [], item);
    }
  };
  for (const b of blocks) {
    const def = registry.get(b.type);
    if (def && !b.hidden) walk(def.fields, b.data);
  }
  return [...out];
}

/** Texto plano visible de los bloques (búsqueda, extractos, llms.txt): campos de texto, listas y texto enriquecido. */
export function blocksToText(blocks: BlockInstance[] | null | undefined, registry: BlockRegistry, richTextToPlain: (doc: unknown) => string): string {
  const out: string[] = [];
  const walk = (fields: AdminField[], data: unknown) => {
    if (!data || typeof data !== 'object') return;
    for (const f of fields) {
      const v = (data as Record<string, unknown>)[f.name];
      if ((f.type === 'text' || f.type === 'textarea') && typeof v === 'string' && v.trim()) out.push(v.trim());
      else if (f.type === 'richText' && v) out.push(richTextToPlain(v));
      else if (f.type === 'list' && Array.isArray(v)) for (const item of v) walk(f.fields ?? [], item);
    }
  };
  for (const b of blocks ?? []) {
    const def = registry.get(b.type);
    if (def && !b.hidden) walk(def.fields, b.data);
  }
  return out.filter(Boolean).join('\n');
}

/** Lo que el editor del panel necesita de cada bloque (serializable: se calcula en el servidor y viaja al cliente). */
export type BlockMeta = { type: string; label: string; icon?: string; fields: AdminField[]; defaults: Record<string, unknown> };

/** Metadatos de los bloques para `blocksRenderer` sin enviar al navegador componentes ni código de servidor. */
export function blockMeta(registry: BlockRegistry): BlockMeta[] {
  return registry.list().map((d) => ({ type: d.type, label: d.label, ...(d.icon && { icon: d.icon }), fields: d.fields, defaults: d.defaults?.() ?? {} }));
}
