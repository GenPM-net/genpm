// Adaptador Next.js: `app/api/forms/[key]/route.ts` → `export { formRoute as POST } from '@/lib/forms/adapters/next';`
// En Server Actions llama directamente a `submitForm(key, formData, { headers: await headers() })`.
import { handleFormPost } from './http.js';

export async function formRoute(req: Request, ctx: { params: Promise<{ key: string }> }): Promise<Response> {
  return handleFormPost(req, (await ctx.params).key);
}
