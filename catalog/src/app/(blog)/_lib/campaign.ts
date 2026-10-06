// "Enviar este post como campaña": crea un borrador de campaña de @core/newsletter con el contenido publicado del post.
import type { AdminResource } from '@/lib/contracts';
import { type ContentAdminRow, getEntry } from '@/lib/content';
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
          // Siempre la versión publicada: los cambios sin publicar (borrador) no se envían a los suscriptores.
          const published = await getEntry<{ title: string; excerpt?: string; body: Doc }>('posts', row.slug, { locale: row.locale });
          if (!published || published.id !== row.id) throw Object.assign(new Error('not published'), { code: 'invalid_state' });
          const d = published.data;
          await createCampaign({ subject: d.title.slice(0, 200), ...(d.excerpt && { preheader: d.excerpt.slice(0, 200) }), body: d.body });
          return row;
        },
      },
    ],
  };
}
