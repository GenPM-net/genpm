// Vista previa de borradores: `/api/preview?token=…` (los enlaces los genera el panel).
import { draftMode } from 'next/headers';
import { previewRoute } from '@/lib/content/adapters/next';

export const dynamic = 'force-dynamic';
export const GET = previewRoute(draftMode);
