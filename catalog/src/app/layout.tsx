// Layout raíz del PROYECTO DE EJEMPLO del workspace (no se publica con ningún kit): muestra cómo integra el usuario
// cabecera/pie (`.site-chrome`), el carrito, los estilos y el banner de cookies.
import type { ReactNode } from 'react';
import '@/lib/ui/ui.css';
import '@/lib/blocks/blocks.css';
import { CartLink } from './(store)/_components/cart-link';
import { CookieSettingsButton } from '@/lib/consent/react';
import { SiteTracking } from './(landing)/_components/site-tracking';
import Link from 'next/link';

export const metadata = { title: 'GenPM catalog example' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="ui-root">
        <header className="site-chrome">
          <nav aria-label="Main">
            <Link href="/">Home</Link> · <Link href="/blog">Blog</Link> · <Link href="/shop">Shop</Link> · <CartLink />
          </nav>
        </header>
        {children}
        <footer className="site-chrome">
          <Link href="/privacy">Privacy</Link> · <Link href="/cookies">Cookies</Link> · <CookieSettingsButton />
        </footer>
        <SiteTracking />
      </body>
    </html>
  );
}
