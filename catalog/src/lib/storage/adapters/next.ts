// Adaptador Next.js (solo drivers `local`/`memory`): `app/api/storage/[[...key]]/route.ts` →
//   export { localStoragePut as PUT, localStorageGet as GET } from '@/lib/storage/adapters/next';
import { getStorage, handleLocalDownload, handleLocalUpload } from '../index.ts';

const secret = () => process.env.STORAGE_SECRET ?? '';

export const localStoragePut = (req: Request) => handleLocalUpload(req, getStorage(), secret());
export const localStorageGet = (req: Request) => handleLocalDownload(req, getStorage(), secret());
