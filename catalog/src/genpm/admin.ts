// Panel de administración: recursos y widgets. Cada kit o paquete instalado indica qué añadir aquí.
import { withSendAsCampaign } from '@/app/(blog)/_lib/campaign'; // kit-blog
import { type AdminWidget, auditAdminResource, defineAdmin } from '@/lib/admin';
import { blogAdminResources } from '@/lib/blog'; // kit-blog
import { commentsAdminResource } from '@/lib/comments'; // kit-blog
import { contentAdminResource } from '@/lib/content';
import { formsAdminResources, submissionsAdminResource } from '@/lib/forms';
import { mediaAdminResource } from '@/lib/media';
import { newsletterAdminResources } from '@/lib/newsletter'; // kit-blog
import { usersAdminResource } from '@/lib/rbac';
import { siteAdminResources } from '@/lib/site';
import { pagePath } from './content';

const pagesResource = contentAdminResource('pages', { path: pagePath });

const [postsResource, ...blogTaxonomies] = blogAdminResources(); // kit-blog

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
  {
    // kit-blog: cola de moderación
    name: 'pending-comments',
    title: 'Comments to moderate',
    permission: 'comments:read',
    load: async (ctx) => ({ value: (await commentsAdminResource.list({ page: 1, pageSize: 1, filters: { status: 'pending' } }, ctx)).total }),
  },
];

export const admin = defineAdmin({
  title: 'Admin',
  resources: [
    pagesResource,
    withSendAsCampaign(postsResource!), // kit-blog
    ...blogTaxonomies, // kit-blog
    commentsAdminResource, // kit-blog
    ...newsletterAdminResources(), // kit-blog
    mediaAdminResource,
    ...formsAdminResources(),
    ...siteAdminResources(),
    usersAdminResource,
    auditAdminResource,
  ],
  widgets,
});
