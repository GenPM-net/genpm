// Carrito: cantidades, cupón, país y método de envío, totales del servidor y pago con Stripe Checkout.
import type { Metadata } from 'next';
import { computeTotals, getCart } from '@/lib/cart';
import { getDb } from '@/lib/db';
import { imageFor } from '@/lib/media';
import { format, money } from '@/lib/money';
import { ratesFor, shippingZones } from '@/lib/shipping';
import '../_components/store.css';
import { applyCode, checkout, setShipping, updateLine } from '../_lib/actions';
import { cookieHeader, currentUserId, one, price } from '../_lib/store';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Cart', robots: { index: false, follow: false } };

const ERRORS: Record<string, string> = {
  insufficient_stock: 'There is not enough stock for that quantity.',
  unavailable: 'That product is no longer available.',
  needs_shipping: 'Choose your country and a shipping method first.',
  issues: 'Please review the notices in your cart.',
  empty: 'Your cart is empty.',
  invalid: 'Please enter a valid email address.',
};

export default async function CartPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const cart = await getCart(await cookieHeader(), await currentUserId());
  const t = cart ? await computeTotals(cart) : null;
  const error = one(sp.cart_error) ?? one(sp.checkout_error);
  if (!t || !t.lines.length)
    return (
      <main className="blk store">
        <h1>Cart</h1>
        <p>Your cart is empty.</p>
        <p>
          <Link className="ui-button ui-button--primary" href="/shop">
            Continue shopping
          </Link>
        </p>
      </main>
    );
  const zones = await getDb().select({ countries: shippingZones.countries }).from(shippingZones);
  const names = new Intl.DisplayNames(['en'], { type: 'region' });
  const countries = [...new Set(zones.flatMap((z) => z.countries))].sort().map((c) => ({ code: c, name: names.of(c) ?? c }));
  const country = t.context.meta.country;
  const rates = country ? await ratesFor(t, country) : [];
  const images = await Promise.all(t.lines.map((l) => imageFor(l.mediaId, { sizes: '96px', alt: '' })));
  return (
    <main className="blk store store-cart">
      <h1>Cart</h1>
      {one(sp.added) && (
        <p role="status" className="ui-alert ui-alert--success">
          Added to your cart.
        </p>
      )}
      {error && (
        <p role="alert" className="ui-alert ui-alert--error">
          {ERRORS[error] ?? 'Something went wrong. Please try again.'}
        </p>
      )}
      {t.issues.length > 0 && (
        <ul className="ui-alert ui-alert--warning">
          {t.issues.map((i) => (
            <li key={`${i.code}:${i.variantId ?? ''}`}>{i.message}</li>
          ))}
        </ul>
      )}
      <table className="ui-table">
        <caption className="ui-visually-hidden">Products in your cart</caption>
        <thead>
          <tr>
            <th scope="col">Product</th>
            <th scope="col">Price</th>
            <th scope="col">Quantity</th>
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>
          {t.lines.map((l, i) => (
            <tr key={l.variantId}>
              <th scope="row">
                {images[i] && <img {...images[i]} alt="" width={64} height={64} className="store-cart__thumb" />}
                <a href={`/products/${l.slug}`}>{l.name}</a>
                {l.title && <span className="blog-meta"> · {l.title}</span>}
              </th>
              <td>{price(l.unitPrice)}</td>
              <td>
                <form action={updateLine} className="store-inline">
                  <input type="hidden" name="variantId" value={l.variantId} />
                  <label className="ui-visually-hidden" htmlFor={`qty-${l.variantId}`}>
                    Quantity of {l.name}
                  </label>
                  <input id={`qty-${l.variantId}`} name="quantity" type="number" min={0} max={99} defaultValue={l.quantity} className="ui-input store-qty" />
                  <button type="submit" className="ui-button ui-button--sm">
                    Update
                  </button>
                </form>
                <form action={updateLine} className="store-inline">
                  <input type="hidden" name="variantId" value={l.variantId} />
                  <input type="hidden" name="quantity" value="0" />
                  <button type="submit" className="ui-button ui-button--sm ui-button--ghost" aria-label={`Remove ${l.name}`}>
                    Remove
                  </button>
                </form>
              </td>
              <td>{price(l.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="store-cart__side">
        <form action={applyCode} className="store-inline">
          <label htmlFor="code">Discount code</label>
          <input id="code" name="code" className="ui-input" defaultValue={t.context.discountCodes[0] ?? ''} maxLength={40} autoComplete="off" />
          <button type="submit" className="ui-button ui-button--sm">
            Apply
          </button>
        </form>
        <form action={setShipping} className="store-shipping">
          <div className="ui-field">
            <label className="ui-field__label" htmlFor="country">
              Ship to
            </label>
            <select id="country" name="country" className="ui-select" defaultValue={country ?? ''} required>
              <option value="" disabled>
                Choose a country…
              </option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          {rates.length > 0 && (
            <fieldset className="ui-field">
              <legend className="ui-field__label">Shipping method</legend>
              {rates.map((r) => (
                <label key={r.id} className="ui-checkbox">
                  <input type="radio" name="shippingRateId" value={r.id} defaultChecked={t.shipping?.code === r.id} /> {r.name} — {r.free ? 'Free' : format(money(r.amount, r.currency))}
                  {r.minDays !== null && r.maxDays !== null && ` (${r.minDays}–${r.maxDays} days)`}
                </label>
              ))}
            </fieldset>
          )}
          <button type="submit" className="ui-button ui-button--sm">
            Update shipping
          </button>
        </form>
        <dl className="store-totals">
          <div>
            <dt>Subtotal</dt>
            <dd>{price(t.subtotal)}</dd>
          </div>
          {t.discounts.map((d) => (
            <div key={`${d.source}:${d.code ?? d.label}`}>
              <dt>{d.label}</dt>
              <dd>−{price(d.amount)}</dd>
            </div>
          ))}
          {t.shipping && (
            <div>
              <dt>Shipping ({t.shipping.label})</dt>
              <dd>{price(t.shipping.amount)}</dd>
            </div>
          )}
          {t.tax && (
            <div>
              <dt>{t.tax.label}</dt>
              <dd>{price(t.tax.amount)}</dd>
            </div>
          )}
          <div className="store-totals__total">
            <dt>Total</dt>
            <dd>{price(t.total)}</dd>
          </div>
        </dl>
        <form action={checkout} className="store-checkout">
          <div className="ui-field">
            <label className="ui-field__label" htmlFor="email">
              Email for your receipt <span aria-hidden="true">*</span>
            </label>
            <input id="email" name="email" type="email" required autoComplete="email" className="ui-input" />
          </div>
          <button type="submit" className="ui-button ui-button--primary">
            Pay securely with Stripe
          </button>
          <p className="blog-meta">
            By paying you accept the <Link href="/terms">terms of sale</Link>. You have 14 days to withdraw (<Link href="/returns">returns</Link>).
          </p>
        </form>
      </div>
    </main>
  );
}
