// Usuario y permisos en Server Components y Route Handlers del kit.
import { cookies } from 'next/headers';
import { ADMIN_HEADER } from '@/lib/admin';
import { getUser } from '@/lib/auth/adapters/next';
import { can } from '@/lib/rbac';

export async function currentUser() {
  return getUser(await cookies());
}

/**
 * Autoriza subidas a @core/media como el resto del panel: cabecera `x-admin-request` (un formulario de otro origen no
 * puede ponerla), sesión, `admin:access` y `media:create`.
 */
export async function authorizeUpload(req: Request): Promise<{ userId: string } | null> {
  if (req.headers.get(ADMIN_HEADER) !== '1') return null;
  const { getUserFromCookieHeader } = await import('@/lib/auth');
  const user = await getUserFromCookieHeader(req.headers.get('cookie'));
  return user && (await can(user.id, 'admin:access')) && (await can(user.id, 'media:create')) ? { userId: user.id } : null;
}
