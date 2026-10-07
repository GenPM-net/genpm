import type { OrderDetail } from '@/lib/orders';
import { format, money } from '@/lib/money';

const STATUS: Record<string, string> = { pending: 'Pending payment', paid: 'Paid', cancelled: 'Cancelled', refunded: 'Refunded', partially_refunded: 'Partially refunded' };
const SHIP: Record<string, string> = { unfulfilled: 'Preparing', partial: 'Partially shipped', fulfilled: 'Shipped', delivered: 'Delivered' };

export function OrderSummary({ order }: { order: OrderDetail }) {
  const m = (n: number) => format(money(n, order.currency));
  return (
    <article aria-labelledby="order-title" className="store-order">
      <h1 id="order-title">Order {order.number}</h1>
      <p>
        {STATUS[order.status] ?? order.status} · {SHIP[order.fulfillmentStatus] ?? order.fulfillmentStatus} · <time dateTime={order.createdAt.toISOString()}>{order.createdAt.toISOString().slice(0, 10)}</time>
      </p>
      <table className="ui-table">
        <caption className="ui-visually-hidden">Products</caption>
        <thead>
          <tr>
            <th scope="col">Product</th>
            <th scope="col">Quantity</th>
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>
          {order.lines.map((l) => (
            <tr key={l.id}>
              <th scope="row">
                {l.name}
                {l.title && ` · ${l.title}`}
              </th>
              <td>{l.quantity}</td>
              <td>{m(l.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="store-totals">
        <div>
          <dt>Subtotal</dt>
          <dd>{m(order.subtotal)}</dd>
        </div>
        {order.discountTotal > 0 && (
          <div>
            <dt>Discounts</dt>
            <dd>−{m(order.discountTotal)}</dd>
          </div>
        )}
        <div>
          <dt>Shipping</dt>
          <dd>{m(order.shippingTotal)}</dd>
        </div>
        {order.taxTotal > 0 && (
          <div>
            <dt>Taxes</dt>
            <dd>{m(order.taxTotal)}</dd>
          </div>
        )}
        <div className="store-totals__total">
          <dt>Total</dt>
          <dd>{m(order.total)}</dd>
        </div>
        {order.refundedTotal > 0 && (
          <div>
            <dt>Refunded</dt>
            <dd>{m(order.refundedTotal)}</dd>
          </div>
        )}
      </dl>
      {order.fulfillments.length > 0 && (
        <section aria-labelledby="shipments-title">
          <h2 id="shipments-title">Shipments</h2>
          <ul>
            {order.fulfillments.map((f) => (
              <li key={f.id}>
                {f.carrier ?? 'Carrier'} {f.trackingNumber && `· ${f.trackingNumber}`}{' '}
                {f.trackingUrl && (
                  <a href={f.trackingUrl} rel="noopener noreferrer">
                    Track package
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
