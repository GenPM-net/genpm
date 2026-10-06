// Fuente de contenido: lo implementan @core/content y los adaptadores (Payload, Keystatic); lo consumen blog,
// blocks, site y los kits sin saber de dónde viene el contenido.

export type ContentStatus = 'draft' | 'scheduled' | 'published' | 'archived';

export type ContentEntry<D = Record<string, unknown>> = {
  id: string;
  collection: string;
  slug: string;
  locale: string;
  status: ContentStatus;
  data: D;
  publishedAt: Date | null;
  updatedAt: Date;
};

export type ContentReadOptions = {
  /** Idioma pedido; sin entrada en ese idioma, la fuente devuelve la del idioma por defecto. */
  locale?: string;
  /** Incluir borradores (solo con un token de vista previa válido). */
  draft?: boolean;
};

export type ContentListQuery = ContentReadOptions & {
  limit?: number;
  offset?: number;
  /** Campo de orden: `publishedAt`, `updatedAt`, `slug` o un campo de `data`. Prefijo `-` = descendente. */
  orderBy?: string;
  /** Igualdad sobre campos de `data` (p. ej. `{ category: 'news' }`). */
  where?: Record<string, string | number | boolean | null>;
};

export interface ContentSource {
  getEntry<D = Record<string, unknown>>(
    collection: string,
    slug: string,
    opts?: ContentReadOptions,
  ): Promise<ContentEntry<D> | null>;
  listEntries<D = Record<string, unknown>>(collection: string, query?: ContentListQuery): Promise<ContentEntry<D>[]>;
}
