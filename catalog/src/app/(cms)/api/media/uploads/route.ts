// Subida directa a @core/storage: crea el registro y devuelve la URL firmada.
import { createUploadRoute } from '@/lib/media/adapters/next';
import { authorizeUpload } from '../../../_lib/session';

export const dynamic = 'force-dynamic';
export const POST = createUploadRoute(authorizeUpload);
