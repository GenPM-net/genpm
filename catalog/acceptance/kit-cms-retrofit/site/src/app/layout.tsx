import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = { title: 'Brightside Plumbing', description: 'Family plumbers in Valencia since 1998.' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="top">
          <Link href="/" className="brand">Brightside Plumbing</Link>
          <nav aria-label="Main">
            <Link href="/about">About</Link>
            <Link href="/services">Services</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/contact">Contact</Link>
          </nav>
        </header>
        {children}
        <footer className="bottom">
          <p>© Brightside Plumbing · Calle Sol 4, Valencia · <a href="tel:+34960000000">+34 960 000 000</a></p>
        </footer>
      </body>
    </html>
  );
}
