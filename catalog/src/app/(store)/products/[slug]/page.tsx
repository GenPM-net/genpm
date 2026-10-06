// Ficha de producto: galería, variantes, precio, stock, descripción, reseñas y JSON-LD Product.
// El precio "antes" no se muestra: en la UE solo puede ser el más bajo de los 30 días previos (Ómnibus);
// con @core/pricing instalado, usa `honestCompareAt` para mostrarlo con garantías.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProduct } from '@/lib/catalog';
import { imageFor } from '@/lib/media';
import { productRating } from '@/lib/reviews';
import { RichText, toPlainText } from '@/lib/rich-text';
import { buildMetadata, jsonLd, jsonLdScript } from '@/lib/seo';
import { AddToCart } from '../../_components/add-to-cart';
import { Reviews } from '../../_components/reviews';
import '../../_components/store.css';
import { one, price, productPath } from '../../_lib/store';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getProduct((await params).slug);
  if (!p) return {};
  const img = await imageFor(p.media[0]);
  const description = p.seoDescription ?? (p.description ? toPlainText(p.description).slice(0, 160) : undefined);
  return (await buildMetadata({ title: p.seoTitle ?? p.name, path: productPath(p), ...(description && { description }), ...(img && { image: img.src }) })) as Metadata;
}

export default async function ProductPage({ params, searchParams }: Props) {
  const p = await getProduct((await params).slug);
  if (!p) notFound();
  const sp = await searchParams;
  const [images, rating] = await Promise.all([Promise.all(p.media.slice(0, 8).map((id, i) => imageFor(id, { sizes: i === 0 ? '(min-width: 768px) 50vw, 100vw' : '25vw' }))), productRating(p.id)]);
  const gallery = images.filter((i) => i !== null);
  const v0 = p.variants.find((v) => v.availability !== 'OutOfStock') ?? p.variants[0];
  const error = one(sp.cart_error);
  const ld =
    v0 &&
    jsonLd.product({
      name: p.name,
      path: productPath(p),
      ...(p.description && { description: toPlainText(p.description).slice(0, 500) }),
      images: gallery.map((g) => g.src),
      ...(v0.sku && { sku: v0.sku }),
      ...(p.brand && { brand: p.brand }),
      price: v0.price,
      availability: v0.availability,
      rating: { average: rating.average, count: rating.count },
    });
  return (
    <main className="blk store-product">
      <div className="store-product__grid">
        <div className="store-gallery">
          {gallery.map((img, i) => (
            <img key={img.src} {...img} alt={img.alt || (i === 0 ? p.name : '')} loading={i === 0 ? 'eager' : 'lazy'} fetchPriority={i === 0 ? 'high' : undefined} decoding="async" />
          ))}
        </div>
        <div>
          {p.categories.length > 0 && (
            <p className="blog-meta">
              {p.categories.map((c, i) => (
                <span key={c.slug}>
                  {i > 0 && ', '}
                  <a href={`/categories/${c.slug}`}>{c.name}</a>
                </span>
              ))}
            </p>
          )}
          <h1>{p.name}</h1>
          {p.priceRange && (
            <p className="store-price store-price--big">
              {p.priceRange.max.amount > p.priceRange.min.amount ? `${price(p.priceRange.min)} – ${price(p.priceRange.max)}` : price(p.priceRange.min)}
            </p>
          )}
          {rating.count > 0 && (
            <p>
              <a href="#reviews">
                {rating.average.toFixed(1)} out of 5 ({rating.count} reviews)
              </a>
            </p>
          )}
          {error && (
            <p role="alert" className="ui-alert ui-alert--error">
              {error === 'insufficient_stock' ? 'There is not enough stock for that quantity.' : 'This option is not available.'}
            </p>
          )}
          <AddToCart product={p} />
          <p className="blog-meta">Shipping costs and delivery times are shown in the cart before payment.</p>
        </div>
      </div>
      {p.description && (
        <section aria-labelledby="description-title" className="store-description">
          <h2 id="description-title">Description</h2>
          <RichText doc={p.description} />
        </section>
      )}
      <Reviews productId={p.id} slug={p.slug} rating={rating} status={one(sp.review)} />
      {ld && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(ld) }} />}
    </main>
  );
}
