// Usuario y permisos en Server Components y Route Handlers del kit.
import { cookies } from 'next/headers';
import { getUser } from '@/lib/auth/adapters/next';
import { can } from '@/lib/rbac';

export async function currentUser() {
  return getUser(await cookies());
}

/** Autoriza subidas a @core/media: usuario con sesión y `media:create`. */
export async function authorizeUpload(req: Request): Promise<{ userId: string } | null> {
  const { getUserFromCookieHeader } = await import('@/lib/auth');
  const user = await getUserFromCookieHeader(req.headers.get('cookie'));
  return user && (await can(user.id, 'media:create')) ? { userId: user.id } : null;
}
