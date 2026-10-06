// Widgets reutilizables del dashboard.
import type { AdminWidget } from './config.ts';

/** Contador: `countWidget('orders-today', 'Orders today', 'orders:read', () => countOrdersToday())`. */
export const countWidget = (name: string, title: string, permission: string, count: () => Promise<number>): AdminWidget => ({
  name,
  title,
  permission,
  load: async () => ({ value: await count() }),
});

/** Lista corta con enlaces (pendientes de moderar, stock bajo…). */
export const listWidget = (
  name: string,
  title: string,
  permission: string,
  rows: () => Promise<Array<{ label: string; value: string | number; href?: string }>>,
): AdminWidget => ({ name, title, permission, load: async () => ({ rows: (await rows()).slice(0, 10) }) });
