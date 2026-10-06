// Inicio de sesión del panel con los proveedores OAuth configurados en @core/auth.
import type { Metadata } from 'next';
import '@/lib/ui/ui.css';
import '../../_components/cms.css';
import { redirect } from 'next/navigation';
import { enabledProviders } from '@/lib/auth';
import { currentUser } from '../../_lib/session';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Sign in', robots: { index: false, follow: false } };

const NAMES: Record<string, string> = { github: 'GitHub', google: 'Google' };

/** Solo rutas del propio sitio (anti open redirect). */
const safeReturn = (v: string | string[] | undefined) => {
  const s = Array.isArray(v) ? v[0] : v;
  return s && /^\/(?![/\\])[\w\-/.?=&%]*$/.test(s) ? s : '/admin';
};

export default async function Login({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const returnTo = safeReturn((await searchParams).returnTo);
  if (await currentUser()) redirect(returnTo);
  const providers = enabledProviders();
  return (
    <main className="ui-root admin-login">
      <h1>Sign in</h1>
      {providers.length ? (
        <ul>
          {providers.map((p) => (
            <li key={p}>
              <a className="ui-button ui-button--primary" href={`/auth/login/${p}?returnTo=${encodeURIComponent(returnTo)}`}>
                Continue with {NAMES[p] ?? p}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p role="alert">No sign-in provider is configured. Set the OAuth variables described in src/lib/auth/AGENTS.md.</p>
      )}
    </main>
  );
}
