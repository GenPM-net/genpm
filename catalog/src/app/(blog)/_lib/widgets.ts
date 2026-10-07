// Widget del panel: comentarios pendientes de moderar (posts y, con kit-store, reseñas).
import type { AdminWidget } from '@/lib/admin';
import { commentsAdminResource } from '@/lib/comments';

export const pendingCommentsWidget: AdminWidget = {
  name: 'pending-comments',
  title: 'Comments to moderate',
  permission: 'comments:read',
  load: async (ctx) => ({ value: (await commentsAdminResource.list({ page: 1, pageSize: 1, filters: { status: 'pending' } }, ctx)).total }),
};
