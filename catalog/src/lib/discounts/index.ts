// @core/discounts — API pública. Al importarlo registra sus pasos en @core/cart y el contador de usos en @core/orders.
export { discountsAdminResource } from './admin.js';
export { DiscountInput, discountsStep, freeShippingStep, registerDiscounts, upsertDiscount } from './discounts.js';
export { type Discount, discountRedemptions, discounts } from './schema.js';
