// Recurso del panel de administración: cualquier paquete describe sus datos así y @core/admin genera lista,
// formulario y acciones sin pantallas escritas a mano. El paquete no depende de @core/admin, solo de este tipo.
import type { ZodType } from 'zod';

export type AdminFieldType =
  | 'text'
  | 'textarea'
  | 'slug'
  | 'email'
  | 'url'
  | 'number'
  | 'money'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'select'
  | 'relation'
  | 'media'
  | 'richText'
  | 'blocks'
  | 'json'
  | (string & {});

export type AdminField = {
  name: string;
  label: string;
  type: AdminFieldType;
  required?: boolean;
  help?: string;
  readOnly?: boolean;
  /** Mostrar como columna en la lista. */
  list?: boolean;
  /** `select`: opciones. */
  options?: Array<{ value: string; label: string }>;
  /** `relation`: nombre del recurso relacionado. */
  relationTo?: string;
  /** `relation` / `media`: admite varios valores. */
  many?: boolean;
};

/** Usuario que actúa en el panel. `can` ya resuelve los permisos (lo inyecta @core/admin con @core/rbac). */
export type AdminContext = {
  user: { id: string; email: string | null; name: string | null };
  can(permission: string): Promise<boolean>;
};

export type AdminListQuery = {
  page: number;
  pageSize: number;
  search?: string;
  sort?: { field: string; dir: 'asc' | 'desc' };
  filters?: Record<string, string>;
};

export type AdminListResult<T> = { rows: T[]; total: number };

/** Acción extra sobre un registro (publicar, programar, reembolsar…). El panel la muestra si `can(permission)`. */
export type AdminAction<T> = {
  name: string;
  label: string;
  permission: string;
  /** Pide confirmación antes de ejecutarla. */
  confirm?: boolean;
  /** Entrada adicional (p. ej. fecha de programación). */
  input?: ZodType;
  /** Si se ofrece para este registro. */
  available?(row: T): boolean;
  run(id: string, input: unknown, ctx: AdminContext): Promise<T>;
};

export type AdminResource<T extends { id: string } = { id: string } & Record<string, unknown>> = {
  /** Identificador en URLs y permisos: `posts` → `/admin/posts`, `posts:read`. */
  name: string;
  label: { singular: string; plural: string };
  icon?: string;
  /** Grupo del menú lateral (`Content`, `Store`…). */
  group?: string;
  fields: AdminField[];
  /** Valida la entrada de create/update. */
  input: ZodType;
  /** Texto con el que se muestra un registro (títulos, relaciones, auditoría). */
  title(row: T): string;
  list(query: AdminListQuery, ctx: AdminContext): Promise<AdminListResult<T>>;
  get(id: string, ctx: AdminContext): Promise<T | null>;
  create?(input: unknown, ctx: AdminContext): Promise<T>;
  update?(id: string, input: unknown, ctx: AdminContext): Promise<T>;
  delete?(id: string, ctx: AdminContext): Promise<void>;
  actions?: AdminAction<T>[];
};

export const defineAdminResource = <T extends { id: string }>(resource: AdminResource<T>): AdminResource<T> =>
  resource;
