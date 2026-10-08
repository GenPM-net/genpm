'use client';
// Cabecera y pie del sitio fuera del panel: el layout raíz envuelve también /admin, y el panel tiene su propia navegación.
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export function SiteChrome({ children }: { children: ReactNode }) {
  const path = usePathname() ?? '';
  return path === '/admin' || path.startsWith('/admin/') ? null : children;
}
