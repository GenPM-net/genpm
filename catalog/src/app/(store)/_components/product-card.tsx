import type { ProductSummary } from '@/lib/catalog';
import { imageFor } from '@/lib/media';
import { price, productPath } from '../_lib/store';

export async function ProductCard({ product, level = 2 }: { product: ProductSummary; level?: number }) {
  const H = `h${Math.min(Math.max(level, 2), 6)}` as 'h2';
  const img = await imageFor(product.image, { sizes: '(min-width: 1024px) 25vw, 50vw', alt: '' });
  const from = product.priceMax.amount > product.price.amount;
  return (
    <article className="blk-card store-card">
      {img && <img {...img} alt={img.alt} loading="lazy" decoding="async" className="store-card__image" />}
      <H className="store-card__title">
        <a href={productPath(product)}>{product.name}</a>
      </H>
      <p className="store-price">
        {from && 'From '}
        {price(product.price)}
      </p>
      {!product.available && <p className="ui-badge ui-badge--warning">Out of stock</p>}
    </article>
  );
}
