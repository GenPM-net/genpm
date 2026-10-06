// Widget del panel: leads por landing en los últimos 7 días (envíos de formularios hechos desde /lp/…).
import { and, count, desc, gte, like } from 'drizzle-orm';
import type { AdminWidget } from '@/lib/admin';
import { getDb } from '@/lib/db';
import { formSubmissions } from '@/lib/forms';
import { LANDING_PREFIX } from './landings';

export const leadsByLandingWidget: AdminWidget = {
  name: 'leads-by-landing',
  title: 'Leads by landing (7 days)',
  permission: 'submissions:read',
  async load() {
    const rows = await getDb()
      .select({ path: formSubmissions.sourcePath, n: count() })
      .from(formSubmissions)
      .where(and(like(formSubmissions.sourcePath, `${LANDING_PREFIX}/%`), gte(formSubmissions.createdAt, new Date(Date.now() - 7 * 86_400_000))))
      .groupBy(formSubmissions.sourcePath)
      .orderBy(desc(count()))
      .limit(10);
    return { rows: rows.map((r) => ({ label: r.path ?? '', value: r.n, href: r.path ?? undefined })) };
  },
};
