// @core/admin — panel de administración generado a partir de `AdminResource`. Servidor: este archivo.
// Cliente: `./client.js` (`AdminApp`) y estilos `./admin.css`.
export { type AdminConfig, type AdminWidget, defineAdmin, fieldsFromZod } from './config.ts';
export { ADMIN_HEADER } from './constants.ts';
export { type AdminAudit, adminAudit } from './schema.ts';
export { type AdminApiOptions, adminContextFor, auditAdminResource, handleAdminApi, listAudit } from './server.ts';
export { countWidget, listWidget } from './widgets.ts';
