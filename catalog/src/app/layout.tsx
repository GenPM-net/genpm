// Layout raíz del PROYECTO DE EJEMPLO del workspace (no se publica con ningún kit): muestra cómo integra el usuario
// cabecera/pie (`.site-chrome`), el carrito, los estilos y el banner de cookies.
import type { ReactNode } from 'react';
import '@/lib/ui/ui.css';
import '@/lib/blocks/blocks.css';
import { CartLink } from './(store)/_components/cart-link';
import { SiteTracking } from './(landing)/_components/site-tracking';

export const metadata = { title: 'GenPM catalog example' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="ui-root">
        <header className="site-chrome">
          <nav aria-label="Main">
            <a href="/">Home</a> · <a href="/blog">Blog</a> · <a href="/shop">Shop</a> · <CartLink />
          </nav>
        </header>
        {children}
        <footer className="site-chrome">
          <a href="/privacy">Privacy</a> · <a href="/cookies">Cookies</a>
        </footer>
        <SiteTracking />
      </body>
    </html>
  );
}
