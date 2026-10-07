// Alta en la newsletter con doble opt-in (@core/newsletter). Sin JavaScript: el navegador vuelve a la página con
// `?newsletter=<estado>` (303). La casilla de consentimiento va sin marcar; su texto versionado queda registrado.
import { AntispamFields } from '@/lib/antispam/react';

const MESSAGES: Record<string, { tone: 'success' | 'error'; text: string }> = {
  pending: { tone: 'success', text: 'Almost done: check your inbox and confirm your subscription.' },
  invalid: { tone: 'error', text: 'Please enter a valid email address.' },
  rate_limited: { tone: 'error', text: 'Too many attempts. Please try again later.' },
  consent_required: { tone: 'error', text: 'Please accept receiving the newsletter to subscribe.' },
};

/** Texto de la casilla. Si lo cambias, cambia también la versión: queda guardada con cada alta. */
export const NEWSLETTER_CONSENT = { version: 'newsletter-2026-10', text: 'I want to receive new posts by email. I can unsubscribe at any time.' };

export function SubscribeForm({ status, source = 'blog' }: { status?: string | undefined; source?: string }) {
  const msg = status ? (MESSAGES[status] ?? { tone: 'error' as const, text: 'Your subscription could not be completed. Please try again.' }) : undefined;
  return (
    <section id="newsletter" aria-labelledby="newsletter-title" className="blk-card blog-newsletter">
      <h2 id="newsletter-title">Get new posts by email</h2>
      {msg && (
        <p role={msg.tone === 'success' ? 'status' : 'alert'} className={`ui-alert ui-alert--${msg.tone}`}>
          {msg.text}
        </p>
      )}
      <form method="post" action="/newsletter/subscribe">
        <div className="ui-field">
          <label className="ui-field__label" htmlFor="newsletter-email">
            Email
          </label>
          <input id="newsletter-email" name="email" type="email" className="ui-input" autoComplete="email" required maxLength={254} />
        </div>
        <div className="ui-field ui-field--check">
          <input id="newsletter-consent" name="consent" type="checkbox" required />
          <label htmlFor="newsletter-consent">{NEWSLETTER_CONSENT.text}</label>
        </div>
        <input type="hidden" name="consentVersion" value={`${NEWSLETTER_CONSENT.version}: ${NEWSLETTER_CONSENT.text}`} />
        <input type="hidden" name="source" value={source} />
        <AntispamFields />
        <button type="submit" className="ui-button ui-button--primary">
          Subscribe
        </button>
        <p className="blog-meta">We will send you a confirmation email.</p>
      </form>
    </section>
  );
}
