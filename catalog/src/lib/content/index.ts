// @core/content — API pública. Importa desde aquí; vista previa para Next.js en adapters/next.ts.
export { type ContentAdminRow, contentAdminResource } from './admin.js';
export {
  archive,
  type CreateEntryInput,
  createEntry,
  deleteEntry,
  getEntryById,
  listRevisions,
  migrateEntries,
  publish,
  publishScheduledJob,
  renameEntry,
  restore,
  restoreRevision,
  saveDraft,
  schedulePublish,
  seedEntry,
  unpublish,
  unschedule,
} from './entries.js';
export { createPreviewToken, type PreviewClaims, safePath, verifyPreviewToken } from './preview.js';
export { contentSource, getEntry, getSingleton, listEntries, reader } from './read.js';
export {
  assertSlug,
  type Collection,
  type CollectionOptions,
  ContentError,
  type ContentErrorCode,
  clearCollections,
  defaultLocale,
  defineCollection,
  defineSingleton,
  getCollection,
  listCollections,
  SINGLETON_SLUG,
  slugify,
} from './registry.js';
export { type ContentRevision, type ContentRow, contentEntries, contentRevisions } from './schema.js';
export { contentSearchSource, contentSitemapSource } from './sources.js';
