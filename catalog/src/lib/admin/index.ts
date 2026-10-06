// @core/admin — panel de administración generado a partir de `AdminResource`. Servidor: este archivo.
// Cliente: `./client.js` (`AdminApp`) y estilos `./admin.css`.
export { type AdminConfig, type AdminWidget, defineAdmin, fieldsFromZod } from './config.js';
export { ADMIN_HEADER } from './constants.js';
export { type AdminAudit, adminAudit } from './schema.js';
export { type AdminApiOptions, adminContextFor, auditAdminResource, handleAdminApi, listAudit } from './server.js';
export { countWidget, listWidget } from './widgets.js';
