// @core/comments — API pública. Importa desde aquí; endpoints en adapters/hono.ts y adapters/next.ts.
export { commentsAdminResource } from './admin.js';
export {
  ban,
  CommentError,
  commentHtml,
  emailHash,
  eraseComments,
  listComments,
  type ModerationAction,
  type Moderation,
  moderate,
  notifyModeratorsJob,
  type PostCommentInput,
  type PublicComment,
  postComment,
  type RatingSummary,
  ratingSummary,
} from './comments.js';
export { type Comment, commentBans, comments } from './schema.js';
