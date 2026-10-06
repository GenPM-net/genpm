// @core/discounts — API pública. Al importarlo registra sus pasos en @core/cart y el contador de usos en @core/orders.
export { discountsAdminResource } from './admin.ts';
export { DiscountInput, discountsStep, freeShippingStep, registerDiscounts, upsertDiscount } from './discounts.ts';
export { type Discount, discountRedemptions, discounts } from './schema.ts';
