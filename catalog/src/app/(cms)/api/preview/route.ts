// Vista previa de borradores: `/api/preview?token=…` (los enlaces los genera el panel). Con `cookies`, el modo
// borrador caduca a la vez que el token.
import { cookies, draftMode } from 'next/headers';
import { previewRoute } from '@/lib/content/adapters/next';

export const dynamic = 'force-dynamic';
export const GET = previewRoute(draftMode, cookies);
