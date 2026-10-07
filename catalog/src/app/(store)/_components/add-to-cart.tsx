// Selector de variante + cantidad + "Añadir al carrito" (acción de servidor; sin JavaScript).
import type { ProductView } from '@/lib/catalog';
import { addToCart } from '../_lib/actions';
import { price, productPath } from '../_lib/store';

export function AddToCart({ product, compact = false }: { product: ProductView; compact?: boolean }) {
  const variants = product.variants.filter((v) => v.active);
  const buyable = variants.filter((v) => v.availability !== 'OutOfStock');
  const id = `add-${product.id}`;
  if (!buyable.length) return <p className="ui-badge ui-badge--warning">Out of stock</p>;
  return (
    <form action={addToCart} className="store-add" aria-label={`Add ${product.name} to cart`}>
      <input type="hidden" name="from" value={productPath(product)} />
      {variants.length > 1 ? (
        <div className="ui-field">
          <label className="ui-field__label" htmlFor={`${id}-variant`}>
            Option
          </label>
          <select id={`${id}-variant`} name="variantId" className="ui-select" defaultValue={buyable[0]!.id}>
            {variants.map((v) => (
              <option key={v.id} value={v.id} disabled={v.availability === 'OutOfStock'}>
                {v.title || v.sku || 'Default'} — {price(v.price)}
                {v.availability === 'OutOfStock' ? ' (out of stock)' : v.availability === 'BackOrder' ? ' (backorder)' : ''}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <input type="hidden" name="variantId" value={buyable[0]!.id} />
      )}
      {!compact && (
        <div className="ui-field">
          <label className="ui-field__label" htmlFor={`${id}-qty`}>
            Quantity
          </label>
          <input id={`${id}-qty`} name="quantity" type="number" min={1} max={99} defaultValue={1} className="ui-input store-qty" inputMode="numeric" />
        </div>
      )}
      <button type="submit" className="ui-button ui-button--primary">
        Add to cart
      </button>
    </form>
  );
}
