// @core/contracts — API pública. Solo tipos y esquemas zod: nada de lógica ni tablas.
export {
  type AdminAction,
  type AdminContext,
  type AdminField,
  type AdminFieldType,
  type AdminListQuery,
  type AdminListResult,
  type AdminResource,
  defineAdminResource,
} from './admin.ts';
export type {
  ContentEntry,
  ContentListQuery,
  ContentReadOptions,
  ContentSource,
  ContentStatus,
} from './content.ts';
export {
  type CommerceEvent,
  CommerceEventSchema,
  type CommerceItem,
  type LeadEvent,
  LeadEventSchema,
  type TrackedEvent,
  TrackedEventSchema,
} from './events.ts';
export { type Money, MoneySchema } from './money.ts';
export type { PaymentProvider, PaymentStatus } from './payment.ts';
export {
  defineSearchSource,
  type SearchChange,
  type SearchDocument,
  type SearchSource,
} from './search.ts';
export { defineSitemapSource, type SitemapSource, type SitemapUrl } from './sitemap.ts';
