// Solo tests: base de datos PGlite con las tablas de todos los paquetes que usa el proyecto de ejemplo (todos los kits).
import * as adminSchema from '@/lib/admin/schema';
import * as antispamSchema from '@/lib/antispam/schema';
import * as authSchema from '@/lib/auth/schema';
import * as cartSchema from '@/lib/cart/schema';
import * as catalogSchema from '@/lib/catalog/schema';
import * as checkoutSchema from '@/lib/checkout/schema';
import * as commentsSchema from '@/lib/comments/schema';
import * as consentSchema from '@/lib/consent/schema';
import * as contentSchema from '@/lib/content/schema';
import { testDb } from '@/lib/db/__fixtures__/pglite';
import * as discountsSchema from '@/lib/discounts/schema';
import * as experimentsSchema from '@/lib/experiments/schema';
import * as formsSchema from '@/lib/forms/schema';
import * as jobsSchema from '@/lib/jobs/schema';
import * as mediaSchema from '@/lib/media/schema';
import * as newsletterSchema from '@/lib/newsletter/schema';
import * as ordersSchema from '@/lib/orders/schema';
import * as pixelsSchema from '@/lib/pixels/schema';
import * as pricingSchema from '@/lib/pricing/schema';
import * as rbacSchema from '@/lib/rbac/schema';
import * as reviewsSchema from '@/lib/reviews/schema';
import * as searchSchema from '@/lib/search/schema';
import * as shippingSchema from '@/lib/shipping/schema';
import * as siteSchema from '@/lib/site/schema';
import * as stripeSchema from '@/lib/stripe/schema';
import * as suppliersSchema from '@/lib/suppliers/schema';

export const projectDb = () =>
  testDb(
    authSchema,
    rbacSchema,
    adminSchema,
    contentSchema,
    mediaSchema,
    formsSchema,
    antispamSchema,
    jobsSchema,
    searchSchema,
    siteSchema,
    commentsSchema,
    newsletterSchema,
    consentSchema,
    pixelsSchema,
    catalogSchema,
    cartSchema,
    checkoutSchema,
    ordersSchema,
    shippingSchema,
    discountsSchema,
    reviewsSchema,
    stripeSchema,
    pricingSchema,
    suppliersSchema,
    experimentsSchema,
  );
