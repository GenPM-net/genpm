// Panel de administración: recursos y widgets. Cada kit o paquete instalado indica qué añadir aquí.
import { withSendAsCampaign } from '@/app/(blog)/_lib/campaign'; // kit-blog
import { pendingCommentsWidget } from '@/app/(blog)/_lib/widgets'; // kit-blog
import { landingPath } from '@/app/(landing)/_lib/landings'; // kit-landing
import { leadsByLandingWidget } from '@/app/(landing)/_lib/widgets'; // kit-landing
import { legalPagesWidget } from '@/app/(store)/_lib/legal'; // kit-store
import { storeWidgets } from '@/app/(store)/_lib/widgets'; // kit-store
import { dropshippingWidgets } from '@/app/(dropshipping)/_lib/widgets'; // kit-dropshipping
import { type AdminWidget, auditAdminResource, defineAdmin } from '@/lib/admin';
import { blogAdminResources } from '@/lib/blog'; // kit-blog
import { catalogAdminResources } from '@/lib/catalog'; // kit-store
import { commentsAdminResource } from '@/lib/comments'; // kit-blog kit-store
import { contentAdminResource } from '@/lib/content';
import { experimentsAdminResource } from '@/lib/experiments'; // kit-landing: A/B tests (optional)
import { discountsAdminResource } from '@/lib/discounts'; // kit-store
import { formsAdminResources, submissionsAdminResource } from '@/lib/forms';
import { mediaAdminResource } from '@/lib/media';
import { newsletterAdminResources } from '@/lib/newsletter'; // kit-blog
import { ordersAdminResource } from '@/lib/orders'; // kit-store
import { priceRulesAdminResource } from '@/lib/pricing'; // kit-dropshipping
import { usersAdminResource } from '@/lib/rbac';
import { shippingAdminResources } from '@/lib/shipping'; // kit-store
import { siteAdminResources } from '@/lib/site';
import { suppliersAdminResources } from '@/lib/suppliers'; // kit-dropshipping
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
  pendingCommentsWidget, // kit-blog
  leadsByLandingWidget, // kit-landing
  ...storeWidgets, // kit-store
  legalPagesWidget, // kit-store
  ...dropshippingWidgets, // kit-dropshipping
];

export const admin = defineAdmin({
  title: 'Admin',
  resources: [
    pagesResource,
    { ...contentAdminResource('landings', { path: landingPath }), group: 'Marketing' }, // kit-landing
    experimentsAdminResource, // kit-landing: A/B tests (optional)
    withSendAsCampaign(postsResource!), // kit-blog
    ...blogTaxonomies, // kit-blog
    commentsAdminResource, // kit-blog kit-store
    ...newsletterAdminResources(), // kit-blog
    ...catalogAdminResources(), // kit-store
    ordersAdminResource, // kit-store
    ...shippingAdminResources(), // kit-store
    discountsAdminResource, // kit-store
    ...suppliersAdminResources(), // kit-dropshipping
    priceRulesAdminResource, // kit-dropshipping
    mediaAdminResource,
    ...formsAdminResources(),
    ...siteAdminResources(),
    usersAdminResource,
    auditAdminResource,
  ],
  widgets,
});
