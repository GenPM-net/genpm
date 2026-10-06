// Compartido por servidor y cliente (sin dependencias).
/** Cabecera obligatoria en peticiones que modifican datos (junto con mismo origen): anti-CSRF. */
export const ADMIN_HEADER = 'x-admin-request';
