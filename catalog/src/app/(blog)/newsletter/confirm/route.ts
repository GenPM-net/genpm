// GET pinta un botón; POST confirma (los escáneres de enlaces del correo no confirman por abrir el enlace).
export { confirmRoute as GET, confirmRoute as POST } from '@/lib/newsletter/adapters/next';
export const dynamic = 'force-dynamic';
