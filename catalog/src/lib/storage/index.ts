// @core/storage — API pública. Importa desde aquí; rutas para los drivers local/memory en adapters/.
export { assertSafeKey, generateKey, isPublicKey, StorageError } from './keys.js';
export { handleLocalDownload, handleLocalUpload } from './local-routes.js';
export { type Backend, backendStorage, diskBackend, type LocalConfig, memoryBackend } from './memory.js';
export type {
  ObjectInfo,
  PresignedUpload,
  PresignUploadOptions,
  PutBody,
  PutOptions,
  StorageProvider,
  StoredObject,
} from './provider.js';
export { type S3Config, s3Storage } from './s3.js';
export { getStorage, setStorage, storageFromEnv } from './storage.js';
