// Resultado del pago consultando el estado real (el pedido lo crea el webhook de Stripe, no esta página).
import '@/genpm'; // registra colecciones, bloques y pasos de la tienda antes de renderizar
import type { Metadata } from 'next';
import { getCheckoutStatus } from '@/lib/checkout';
import { one } from '../../_lib/store';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Order status', robots: { index: false, follow: false } };

export default async function Success({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const id = one((await searchParams).session_id) ?? '';
  const s = /^cs_[A-Za-z0-9_]{1,200}$/.test(id) ? await getCheckoutStatus(id) : { status: 'pending' as const };
  return (
    <main className="blk">
      {s.status === 'paid' ? (
        <>
          <h1>Thank you for your order!</h1>
          <p>
            Your order number is <strong>{s.orderNumber}</strong>. We have sent the confirmation and a link to follow it to your email.
          </p>
        </>
      ) : s.status === 'refunded' ? (
        <>
          <h1>Sorry, an item sold out</h1>
          <p>Someone bought the last unit at the same time. Your payment has been refunded in full.</p>
        </>
      ) : s.status === 'expired' ? (
        <>
          <h1>The payment was not completed</h1>
          <p>
            Nothing was charged. <Link href="/cart">Back to your cart</Link>.
          </p>
        </>
      ) : (
        <>
          <meta httpEquiv="refresh" content="3" />
          <h1>Confirming your payment…</h1>
          <p role="status">This page will update in a few seconds. You will also receive an email.</p>
        </>
      )}
    </main>
  );
}
