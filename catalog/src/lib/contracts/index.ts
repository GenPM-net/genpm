// @core/contracts — API pública. Solo tipos y esquemas zod: nada de lógica ni tablas.
export {
  type AdminContext,
  type AdminField,
  type AdminFieldType,
  type AdminListQuery,
  type AdminListResult,
  type AdminResource,
  defineAdminResource,
} from './admin.js';
export type {
  ContentEntry,
  ContentListQuery,
  ContentReadOptions,
  ContentSource,
  ContentStatus,
} from './content.js';
export {
  type CommerceEvent,
  CommerceEventSchema,
  type CommerceItem,
  type LeadEvent,
  LeadEventSchema,
  type TrackedEvent,
  TrackedEventSchema,
} from './events.js';
export { type Money, MoneySchema } from './money.js';
export type { PaymentProvider, PaymentStatus } from './payment.js';
export {
  defineSearchSource,
  type SearchChange,
  type SearchDocument,
  type SearchSource,
} from './search.js';
export { defineSitemapSource, type SitemapSource, type SitemapUrl } from './sitemap.js';
