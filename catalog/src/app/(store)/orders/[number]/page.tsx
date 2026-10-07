// Pedido de cliente: accesible para su dueño con sesión o con el enlace firmado del email (`?token=`).
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getOrderForCustomer } from '@/lib/orders';
import { OrderSummary } from '../../_components/order-summary';
import '../../_components/store.css';
import { currentUserId, one } from '../../_lib/store';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Your order', robots: { index: false, follow: false } };

export default async function OrderPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { number } = await params;
  const order = await getOrderForCustomer(number, { userId: await currentUserId(), token: one((await searchParams).token) ?? null });
  if (!order) notFound(); // también si existe pero no es tuyo
  return (
    <main className="blk store">
      <OrderSummary order={order} />
    </main>
  );
}
