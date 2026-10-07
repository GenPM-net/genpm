// Fuente de documentos para el buscador del sitio: la implementan content, blog, catalog…; la consume @core/search.

export type SearchDocument = {
  /** Único dentro de `type`. */
  id: string;
  /** Tipo de resultado: `page`, `post`, `product`. */
  type: string;
  url: string;
  title: string;
  /** Texto plano (sin HTML ni Markdown). */
  body: string;
  locale?: string;
  updatedAt?: Date;
};

export type SearchChange = { op: 'upsert'; doc: SearchDocument } | { op: 'delete'; type: string; id: string };

export type SearchSource = {
  type: string;
  /** Todos los documentos publicados (reindexado completo). */
  documents(): AsyncIterable<SearchDocument>;
  /** Avisos incrementales (publicar, despublicar). Devuelve la función para darse de baja. */
  subscribe?(listener: (change: SearchChange) => void | Promise<void>): () => void;
};

export const defineSearchSource = (source: SearchSource): SearchSource => source;
