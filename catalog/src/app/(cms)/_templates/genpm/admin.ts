// Panel de administración: recursos y widgets. Cada kit o paquete instalado indica qué añadir aquí.
import { type AdminWidget, auditAdminResource, defineAdmin } from '@/lib/admin';
import { contentAdminResource } from '@/lib/content';
import { formsAdminResources, submissionsAdminResource } from '@/lib/forms';
import { mediaAdminResource } from '@/lib/media';
import { usersAdminResource } from '@/lib/rbac';
import { siteAdminResources } from '@/lib/site';
import { pagePath } from './content';

const pagesResource = contentAdminResource('pages', { path: pagePath });

const widgets: AdminWidget[] = [
  {
    name: 'draft-pages',
    title: 'Pages in draft',
    permission: 'pages:read',
    load: async (ctx) => ({ value: (await pagesResource.list({ page: 1, pageSize: 1, filters: { status: 'draft' } }, ctx)).total }),
  },
  {
    name: 'recent-submissions',
    title: 'Latest form submissions',
    permission: 'submissions:read',
    load: async (ctx) => ({
      rows: (await submissionsAdminResource.list({ page: 1, pageSize: 5 }, ctx)).rows.map((s) => ({
        label: submissionsAdminResource.title(s),
        value: s.createdAt.toISOString().slice(0, 10),
        href: `/admin/submissions/${s.id}`,
      })),
    }),
  },
];

export const admin = defineAdmin({
  title: 'Admin',
  resources: [
    pagesResource,
    mediaAdminResource,
    ...formsAdminResources(),
    ...siteAdminResources(),
    usersAdminResource,
    auditAdminResource,
  ],
  widgets,
});
