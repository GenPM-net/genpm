// Envío de formularios (@core/forms). Importa @/genpm para registrar los formularios de código.
import '@/genpm';
import { formRoute } from '@/lib/forms/adapters/next';

export const dynamic = 'force-dynamic';
export const POST = formRoute;
