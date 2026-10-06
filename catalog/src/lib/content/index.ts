// @core/content — API pública. Importa desde aquí; vista previa para Next.js en adapters/next.ts.
export { type ContentAdminRow, contentAdminResource } from './admin.ts';
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
} from './entries.ts';
export { createPreviewToken, type PreviewClaims, safePath, verifyPreviewToken } from './preview.ts';
export { contentSource, countEntries, getEntry, getSingleton, listEntries, reader } from './read.ts';
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
} from './registry.ts';
export { type ContentRevision, type ContentRow, contentEntries, contentRevisions } from './schema.ts';
export { contentSearchSource, contentSitemapSource } from './sources.ts';
