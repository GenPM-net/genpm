import { draftMode } from 'next/headers';
import { exitPreviewRoute } from '@/lib/content/adapters/next';

export const dynamic = 'force-dynamic';
export const GET = exitPreviewRoute(draftMode);
