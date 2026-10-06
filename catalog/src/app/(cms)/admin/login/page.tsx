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

export default async function Login() {
  if (await currentUser()) redirect('/admin');
  const providers = enabledProviders();
  return (
    <main className="ui-root admin-login">
      <h1>Sign in</h1>
      {providers.length ? (
        <ul>
          {providers.map((p) => (
            <li key={p}>
              <a className="ui-button ui-button--primary" href={`/auth/login/${p}?returnTo=${encodeURIComponent('/admin')}`}>
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
