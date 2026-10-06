// Alta en la newsletter con doble opt-in (@core/newsletter). Sin JavaScript: 303 de vuelta con `?newsletter=`.
import { AntispamFields } from '@/lib/antispam/react';

const MESSAGES: Record<string, { tone: 'success' | 'error'; text: string }> = {
  pending: { tone: 'success', text: 'Almost done: check your inbox and confirm your subscription.' },
  invalid: { tone: 'error', text: 'Please enter a valid email address.' },
  rate_limited: { tone: 'error', text: 'Too many attempts. Please try again later.' },
};

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
        <input type="hidden" name="source" value={source} />
        <AntispamFields />
        <button type="submit" className="ui-button ui-button--primary">
          Subscribe
        </button>
        <p className="blog-meta">We will send you a confirmation email. You can unsubscribe at any time with one click.</p>
      </form>
    </section>
  );
}
