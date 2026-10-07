// Landing de producto único: bloques de una landing con el mismo slug (opcional) + "Comprar ahora" directo a Stripe,
// con plazo de entrega real, origen y devoluciones visibles antes de pagar.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { blocks } from '@/genpm';
import { AddToCart } from '@/app/(store)/_components/add-to-cart';
import '@/app/(store)/_components/store.css';
import { one, price, productPath } from '@/app/(store)/_lib/store';
import { RenderBlocks } from '@/lib/blocks';
import { loadBlockMedia } from '@/lib/blocks/media';
import { getProduct } from '@/lib/catalog';
import { ConsentGate } from '@/lib/consent/react';
import { getEntry } from '@/lib/content';
import { getDb } from '@/lib/db';
import { Form } from '@/lib/forms';
import { imageFor } from '@/lib/media';
import { RichText, toPlainText } from '@/lib/rich-text';
import { buildMetadata } from '@/lib/seo';
import { shippingZones } from '@/lib/shipping';
import { DeliveryNotice } from '../../_components/delivery-notice';
import { TrackView } from '../../_components/track-view';
import { buyNow } from '../../_lib/actions';
import Link from 'next/link';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const ERRORS: Record<string, string> = {
  needs_shipping: 'Choose the country we should ship to.',
  insufficient_stock: 'There is not enough stock for that quantity.',
  unavailable: 'That option is no longer available.',
  invalid: 'Please check your email address.',
  issues: 'We cannot ship this product to that country.',
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getProduct((await params).slug);
  if (!p) return {};
  const img = await imageFor(p.media[0]);
  const description = p.seoDescription ?? (p.description ? toPlainText(p.description).slice(0, 160) : undefined);
  // Canónica: la ficha de producto (evita contenido duplicado entre /p y /products).
  return (await buildMetadata({ title: p.seoTitle ?? p.name, path: productPath(p), ...(description && { description }), ...(img && { image: img.src }) })) as Metadata;
}

export default async function ProductLanding({ params, searchParams }: Props) {
  const { slug } = await params;
  const p = await getProduct(slug);
  if (!p) notFound();
  const sp = await searchParams;
  const landing = await getEntry<{ blocks: Parameters<typeof RenderBlocks>[0]['blocks'] }>('landings', slug);
  const media = landing ? await loadBlockMedia(landing.data.blocks, blocks) : {};
  const hero = await imageFor(p.media[0], { sizes: '(min-width: 768px) 50vw, 100vw' });
  const zones = await getDb().select({ countries: shippingZones.countries }).from(shippingZones);
  const names = new Intl.DisplayNames(['en'], { type: 'region' });
  const countries = [...new Set(zones.flatMap((z) => z.countries))].sort().map((c) => ({ code: c, name: names.of(c) ?? c }));
  const variants = p.variants.filter((v) => v.active && v.availability !== 'OutOfStock');
  const error = one(sp.buy_error);
  return (
    <main className="landing landing--minimal">
      <style>{'.site-chrome{display:none}'}</style>
      {landing ? (
        <RenderBlocks blocks={landing.data.blocks} registry={blocks} media={media} renderForm={(key) => <Form formKey={key} searchParams={sp} />} />
      ) : (
        <section className="blk blk-hero" aria-labelledby="p-title">
          <div className="blk-hero__text">
            <h1 id="p-title" className="blk-hero__title">
              {p.name}
            </h1>
            {p.priceRange && <p className="store-price store-price--big">{price(p.priceRange.min)}</p>}
          </div>
          {hero && <img {...hero} alt={hero.alt || p.name} className="blk-hero__image" loading="eager" fetchPriority="high" decoding="async" />}
        </section>
      )}
      <section id="buy" aria-labelledby="buy-title" className="blk drop-buy">
        <h2 id="buy-title">{landing ? `Get your ${p.name}` : 'Buy now'}</h2>
        {error && (
          <p role="alert" className="ui-alert ui-alert--error">
            {ERRORS[error] ?? 'Something went wrong. Please try again.'}
          </p>
        )}
        {variants.length ? (
          <form action={buyNow} className="store-add">
            <input type="hidden" name="slug" value={p.slug} />
            {variants.length > 1 ? (
              <div className="ui-field">
                <label className="ui-field__label" htmlFor="buy-variant">
                  Option
                </label>
                <select id="buy-variant" name="variantId" className="ui-select">
                  {variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.title || 'Default'} — {price(v.price)}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <input type="hidden" name="variantId" value={variants[0]!.id} />
            )}
            <div className="ui-field">
              <label className="ui-field__label" htmlFor="buy-qty">
                Quantity
              </label>
              <input id="buy-qty" name="quantity" type="number" min={1} max={99} defaultValue={1} className="ui-input store-qty" />
            </div>
            <div className="ui-field">
              <label className="ui-field__label" htmlFor="buy-country">
                Ship to <span aria-hidden="true">*</span>
              </label>
              <select id="buy-country" name="country" className="ui-select" required defaultValue="">
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
            <div className="ui-field">
              <label className="ui-field__label" htmlFor="buy-email">
                Email for your receipt <span aria-hidden="true">*</span>
              </label>
              <input id="buy-email" name="email" type="email" required autoComplete="email" className="ui-input" />
            </div>
            <DeliveryNotice product={p} />
            <button type="submit" className="ui-button ui-button--primary">
              Continue to secure payment
            </button>
            <p className="blog-meta">
              Shipping cost is added at checkout. By paying you accept the <Link href="/terms">terms of sale</Link>.
            </p>
          </form>
        ) : (
          <p className="ui-badge ui-badge--warning">Out of stock</p>
        )}
        <div className="drop-alt">
          <p>Prefer to keep shopping?</p>
          <AddToCart product={p} compact />
        </div>
      </section>
      {!landing && p.description && (
        <section className="blk" aria-labelledby="p-desc">
          <h2 id="p-desc">Details</h2>
          <RichText doc={p.description} />
        </section>
      )}
      {p.priceRange && (
        <ConsentGate category="marketing">
          <TrackView item={{ id: p.id, name: p.name, price: p.priceRange.min }} />
        </ConsentGate>
      )}
    </main>
  );
}
