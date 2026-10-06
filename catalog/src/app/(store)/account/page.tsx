// Área de cliente: pedidos de la cuenta (las direcciones se guardan en cada pedido; Stripe las recuerda en el pago).
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentUser } from '@/app/(cms)/_lib/session';
import { format, money } from '@/lib/money';
import { listOrdersForUser } from '@/lib/orders';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Your account', robots: { index: false, follow: false } };

export default async function Account() {
  const user = await currentUser();
  if (!user) redirect('/admin/login?returnTo=/account');
  const orders = await listOrdersForUser(user.id);
  return (
    <main className="blk store">
      <h1>Your account</h1>
      <p>Signed in as {user.email ?? user.name}.</p>
      <h2>Orders</h2>
      {orders.length ? (
        <ul>
          {orders.map((o) => (
            <li key={o.id}>
              <a href={`/orders/${encodeURIComponent(o.number)}`}>Order {o.number}</a> · {o.createdAt.toISOString().slice(0, 10)} · {format(money(o.total, o.currency))}
            </li>
          ))}
        </ul>
      ) : (
        <p>You have no orders yet.</p>
      )}
      <form action="/auth/logout" method="post">
        <button type="submit" className="ui-button">
          Sign out
        </button>
      </form>
    </main>
  );
}
