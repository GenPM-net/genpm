import '@/genpm';
import { handleLandingLead } from '../../../../_lib/conversion';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ slug: string; formKey: string }> }): Promise<Response> {
  const { slug, formKey } = await ctx.params;
  return handleLandingLead(req, slug, formKey);
}
