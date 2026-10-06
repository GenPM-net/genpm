// GET desde el enlace del email (pinta un botón que hace POST); POST de un clic desde Gmail/Yahoo (RFC 8058).
export { unsubscribeRoute as GET, unsubscribeRoute as POST } from '@/lib/newsletter/adapters/next';
export const dynamic = 'force-dynamic';
