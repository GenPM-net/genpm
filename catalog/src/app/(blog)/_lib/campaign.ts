// "Enviar este post como campaña": crea un borrador de campaña de @core/newsletter con el contenido del post.
import type { AdminResource } from '@/lib/contracts';
import type { ContentAdminRow } from '@/lib/content';
import { createCampaign } from '@/lib/newsletter';
import type { Doc } from '@/lib/rich-text';

export function withSendAsCampaign(posts: AdminResource<ContentAdminRow>): AdminResource<ContentAdminRow> {
  return {
    ...posts,
    actions: [
      ...(posts.actions ?? []),
      {
        name: 'send-as-campaign',
        label: 'Create newsletter campaign',
        permission: 'campaigns:create',
        confirm: true,
        available: (r) => r.status === 'published',
        async run(id, _input, ctx) {
          if (!(await ctx.can('campaigns:create'))) throw Object.assign(new Error('forbidden'), { code: 'forbidden' });
          const row = await posts.get(id, ctx);
          if (!row) throw Object.assign(new Error('not found'), { code: 'not_found' });
          const d = row.data as { title: string; excerpt?: string; body: Doc };
          await createCampaign({ subject: d.title.slice(0, 200), ...(d.excerpt && { preheader: d.excerpt.slice(0, 200) }), body: d.body });
          return row;
        },
      },
    ],
  };
}
