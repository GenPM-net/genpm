// Confirma la subida: comprueba el tipo real del archivo y elimina metadatos.
import { confirmUploadRoute } from '@/lib/media/adapters/next';
import { authorizeUpload } from '../../../../../_lib/session';

export const dynamic = 'force-dynamic';
export const POST = confirmUploadRoute(authorizeUpload);
