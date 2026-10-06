// Adaptador Next.js:
//   app/api/checkout/route.ts        → export const { POST } = checkoutRoute(currentUserId);
//   app/api/checkout/status/route.ts → export { checkoutStatusRoute as GET } from '@/lib/checkout/adapters/next';
import { type CheckoutPaths, type CurrentUserId, handleCheckoutStatus, handleStartCheckout } from './http.js';

export const checkoutRoute = (currentUserId: CurrentUserId, paths: CheckoutPaths = { success: '/checkout/success', cancel: '/cart' }) => ({
  POST: (req: Request) => handleStartCheckout(req, currentUserId, paths),
});
export const checkoutStatusRoute = (req: Request) => handleCheckoutStatus(req);
