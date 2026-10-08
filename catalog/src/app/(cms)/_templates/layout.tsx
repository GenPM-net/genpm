// Plantilla del layout raíz para un sitio NUEVO: cópiala a `src/app/layout.tsx` (en un sitio existente, añade solo lo que falte).
// Cabecera y pie salen de los menús `header` / `footer` y del nombre del sitio editados en el admin.
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import '@/lib/ui/ui.css';
import '@/lib/blocks/blocks.css';
import { SiteChrome } from '@/app/(cms)/_components/site-chrome';
import { getMenu, getSiteSettings, type MenuItem } from '@/lib/site';

// Lee menús y ajustes de la base de datos en cada petición: sin esto, `next build` intenta prerenderizar y necesita la BD.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings();
  // Sin `title.template`: `buildMetadata` (@core/seo) ya devuelve `Página · Sitio` y la plantilla lo duplicaría.
  return { title: s?.name ?? 'Site', ...(s?.tagline && { description: s.tagline }) };
}

function Menu({ items, label }: { items: MenuItem[]; label: string }) {
  if (!items.length) return null;
  return (
    <nav aria-label={label}>
      <ul>
        {items.map((i) => (
          <li key={`${i.href}-${i.label}`}>
            <Link href={i.href} {...(i.newTab && { target: '_blank', rel: 'noopener noreferrer' })}>
              {i.label}
            </Link>
            {i.children?.length ? <Menu items={i.children} label={i.label} /> : null}
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [settings, header, footer] = await Promise.all([getSiteSettings(), getMenu('header'), getMenu('footer')]);
  return (
    <html lang={process.env.CONTENT_DEFAULT_LOCALE ?? 'en'}>
      <body className="ui-root">
        <SiteChrome>
          <header className="site-chrome">
            <Link href="/">{settings?.name ?? 'Site'}</Link>
            <Menu items={header} label="Main" />
          </header>
        </SiteChrome>
        {children}
        <SiteChrome>
          <footer className="site-chrome">
            <Menu items={footer} label="Footer" />
          </footer>
        </SiteChrome>
      </body>
    </html>
  );
}
