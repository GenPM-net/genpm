// Enlace al carrito con el número de unidades, para la cabecera del sitio (Server Component).
import { cartLineCount, getCart } from '@/lib/cart';
import { cookieHeader, currentUserId } from '../_lib/store';
import Link from 'next/link';

export async function CartLink() {
  const cart = await getCart(await cookieHeader(), await currentUserId());
  const n = cart ? await cartLineCount(cart.id) : 0;
  return (
    <Link href="/cart" className="store-cart-link">
      Cart <span aria-label={`${n} items`}>({n})</span>
    </Link>
  );
}
