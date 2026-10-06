// Cron de @core/jobs (publicación programada, emails de formularios, reindexado…). Protegido con CRON_SECRET.
import '@/genpm';
import { cronRoute } from '@/lib/jobs/adapters/next';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export const GET = cronRoute;
export const POST = cronRoute;
