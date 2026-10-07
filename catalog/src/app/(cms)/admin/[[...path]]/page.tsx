// Panel: comprueba sesión y `admin:access` en el servidor; la app cliente se construye desde /api/admin/schema.
import type { Metadata } from 'next';
import '@/lib/ui/ui.css';
import '../../_components/cms.css';
import { redirect } from 'next/navigation';
import { blocks } from '@/genpm/blocks';
import { blockMeta } from '@/lib/blocks';
import { can } from '@/lib/rbac';
import { currentUser } from '../../_lib/session';
import { AdminClient } from '../../_components/admin-client';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin', robots: { index: false, follow: false } };

export default async function AdminPage({ params }: { params: Promise<{ path?: string[] }> }) {
  const user = await currentUser();
  if (!user) redirect('/admin/login');
  if (!(await can(user.id, 'admin:access')))
    return (
      <main className="ui-root admin-denied">
        <h1>No access</h1>
        <p>Your account ({user.email ?? user.id}) has no admin role yet. Ask the site owner to grant you one.</p>
        <form action="/auth/logout" method="post">
          <button className="ui-button" type="submit">Sign out</button>
        </form>
      </main>
    );
  const { path } = await params;
  return <AdminClient path={(path ?? []).map(encodeURIComponent).join('/')} blocks={blockMeta(blocks)} />;
}
