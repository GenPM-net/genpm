// API JSON del panel (@core/admin): sesión, permisos, anti-CSRF y auditoría.
import { admin } from '@/genpm';
import { adminRouteHandlers } from '@/lib/admin/adapters/next';

export const dynamic = 'force-dynamic';
export const { GET, POST, PUT, DELETE } = adminRouteHandlers(admin);
