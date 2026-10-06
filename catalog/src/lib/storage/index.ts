// @core/storage — API pública. Importa desde aquí; rutas para los drivers local/memory en adapters/.
export { assertSafeKey, generateKey, isPublicKey, StorageError } from './keys.ts';
export { handleLocalDownload, handleLocalUpload } from './local-routes.ts';
export { type Backend, backendStorage, diskBackend, type LocalConfig, memoryBackend } from './memory.ts';
export type {
  ObjectInfo,
  PresignedUpload,
  PresignUploadOptions,
  PutBody,
  PutOptions,
  StorageProvider,
  StoredObject,
} from './provider.ts';
export { type S3Config, s3Storage } from './s3.ts';
export { getStorage, setStorage, storageFromEnv } from './storage.ts';
