// Comentarios aprobados y formulario (funciona sin JavaScript: POST y 303 de vuelta con `?comment=`).
import { listComments } from '@/lib/comments';
import { formatDate } from '../_lib/paths';
import { AntispamFields } from './antispam-fields';

const MESSAGES: Record<string, { tone: 'success' | 'error'; text: string }> = {
  approved: { tone: 'success', text: 'Thanks! Your comment is published.' },
  pending: { tone: 'success', text: 'Thanks! Your comment will appear after moderation.' },
  invalid: { tone: 'error', text: 'Please write a comment and, as a guest, your name and email.' },
  spam: { tone: 'error', text: 'Your comment could not be sent. Please try again.' },
  rate_limited: { tone: 'error', text: 'Too many comments. Please wait a few minutes.' },
  banned: { tone: 'error', text: 'You cannot comment on this site.' },
};

export async function Comments({ postId, status }: { postId: string; status?: string | undefined }) {
  const { comments, total } = await listComments('post', postId, { order: 'oldest' });
  const msg = status ? MESSAGES[status] : undefined;
  return (
    <section id="comments" aria-labelledby="comments-title" className="blog-comments">
      <h2 id="comments-title">Comments ({total})</h2>
      {msg && (
        <p role={msg.tone === 'success' ? 'status' : 'alert'} className={`ui-alert ui-alert--${msg.tone}`}>
          {msg.text}
        </p>
      )}
      <ol className="blog-comments__list">
        {comments.map((c) => (
          <li key={c.id}>
            <article>
              <p className="blog-meta">
                <strong>{c.authorName}</strong> · <time dateTime={c.createdAt.toISOString()}>{formatDate(c.createdAt)}</time>
              </p>
              <p className="blog-comment__body">{c.body}</p>
              {c.replies.length > 0 && (
                <ol>
                  {c.replies.map((r) => (
                    <li key={r.id}>
                      <p className="blog-meta">
                        <strong>{r.authorName}</strong>
                      </p>
                      <p className="blog-comment__body">{r.body}</p>
                    </li>
                  ))}
                </ol>
              )}
            </article>
          </li>
        ))}
      </ol>
      <form method="post" action={`/api/comments/post/${encodeURIComponent(postId)}`} className="blog-comment-form">
        <h3>Leave a comment</h3>
        <div className="ui-field">
          <label className="ui-field__label" htmlFor="comment-body">
            Comment <span aria-hidden="true">*</span>
          </label>
          <textarea id="comment-body" name="body" className="ui-textarea" rows={5} required maxLength={5000} />
        </div>
        <div className="ui-field">
          <label className="ui-field__label" htmlFor="comment-name">
            Name (guests)
          </label>
          <input id="comment-name" name="name" className="ui-input" autoComplete="name" maxLength={80} />
        </div>
        <div className="ui-field">
          <label className="ui-field__label" htmlFor="comment-email">
            Email (guests, never published)
          </label>
          <input id="comment-email" name="email" type="email" className="ui-input" autoComplete="email" maxLength={254} />
        </div>
        <AntispamFields />
        <button type="submit" className="ui-button ui-button--primary">
          Post comment
        </button>
      </form>
    </section>
  );
}
