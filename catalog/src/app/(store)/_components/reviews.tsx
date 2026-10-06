// Reseñas aprobadas con valoración media y formulario (moderado; "compra verificada" si hay pedido entregado).
import { AntispamFields } from '@/lib/antispam/react';
import { listReviews, type ProductRating } from '@/lib/reviews';
import { submitReview } from '../_lib/actions';

const MESSAGES: Record<string, { tone: 'success' | 'error'; text: string }> = {
  approved: { tone: 'success', text: 'Thanks! Your review is published.' },
  pending: { tone: 'success', text: 'Thanks! Your review will appear after moderation.' },
  invalid: { tone: 'error', text: 'Please choose a rating and write your review (guests: name and email).' },
  spam: { tone: 'error', text: 'Your review could not be sent. Please try again.' },
  rate_limited: { tone: 'error', text: 'Too many attempts. Please wait a few minutes.' },
  banned: { tone: 'error', text: 'You cannot post reviews on this site.' },
};

const stars = (n: number) => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));

export async function Reviews({ productId, slug, rating, status }: { productId: string; slug: string; rating: ProductRating; status?: string | undefined }) {
  const { reviews } = await listReviews(productId, { perPage: 20 });
  const msg = status ? MESSAGES[status] : undefined;
  return (
    <section id="reviews" aria-labelledby="reviews-title" className="store-reviews">
      <h2 id="reviews-title">Reviews</h2>
      {rating.count > 0 ? (
        <p>
          <span aria-hidden="true">{stars(rating.average)}</span> {rating.average.toFixed(1)} out of 5 ({rating.count} reviews)
        </p>
      ) : (
        <p>No reviews yet.</p>
      )}
      {msg && (
        <p role={msg.tone === 'success' ? 'status' : 'alert'} className={`ui-alert ui-alert--${msg.tone}`}>
          {msg.text}
        </p>
      )}
      <ol className="store-reviews__list">
        {reviews.map((r) => (
          <li key={r.id}>
            <p>
              <span aria-hidden="true">{stars(r.rating)}</span>
              <span className="ui-visually-hidden">{r.rating} out of 5</span> <strong>{r.authorName}</strong>
              {r.verified && <span className="ui-badge ui-badge--success"> Verified purchase</span>}
            </p>
            <p className="store-review__body">{r.body}</p>
          </li>
        ))}
      </ol>
      <form action={submitReview} className="store-review-form">
        <h3>Write a review</h3>
        <input type="hidden" name="productId" value={productId} />
        <input type="hidden" name="slug" value={slug} />
        <fieldset className="ui-field">
          <legend className="ui-field__label">
            Rating <span aria-hidden="true">*</span>
          </legend>
          {[5, 4, 3, 2, 1].map((n) => (
            <label key={n} className="ui-checkbox">
              <input type="radio" name="rating" value={n} required /> {n} stars
            </label>
          ))}
        </fieldset>
        <div className="ui-field">
          <label className="ui-field__label" htmlFor="review-body">
            Review <span aria-hidden="true">*</span>
          </label>
          <textarea id="review-body" name="body" className="ui-textarea" rows={4} required maxLength={5000} />
        </div>
        <div className="ui-field">
          <label className="ui-field__label" htmlFor="review-name">
            Name (guests)
          </label>
          <input id="review-name" name="name" className="ui-input" autoComplete="name" maxLength={80} />
        </div>
        <div className="ui-field">
          <label className="ui-field__label" htmlFor="review-email">
            Email (guests, never published)
          </label>
          <input id="review-email" name="email" type="email" className="ui-input" autoComplete="email" maxLength={254} />
        </div>
        <AntispamFields />
        <button type="submit" className="ui-button ui-button--primary">
          Submit review
        </button>
      </form>
    </section>
  );
}
