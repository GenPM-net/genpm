import { Hono } from 'hono';
import { beforeEach, describe, expect, it } from 'vitest';
import { formTimingToken } from '../antispam/index.js';
import * as antispamSchema from '../antispam/schema.js';
import { upsertOAuthUser } from '../auth/index.js';
import * as authSchema from '../auth/schema.js';
import type { AdminContext } from '../contracts/index.js';
import { testDb } from '../db/__fixtures__/pglite.js';
import type { Db } from '../db/index.js';
import { type EmailMessage, setEmailProvider } from '../email/index.js';
import { runDue } from '../jobs/index.js';
import * as jobsSchema from '../jobs/schema.js';
import { commentRoutes } from './adapters/hono.js';
import { commentRoute } from './adapters/next.js';
import * as schema from './schema.js';
import {
  ban,
  CommentError,
  commentHtml,
  comments,
  commentsAdminResource,
  eraseComments,
  listComments,
  moderate,
  postComment,
  ratingSummary,
} from './index.js';

let db: Db;
const sent: EmailMessage[] = [];
const headers = () => new Headers({ 'x-forwarded-for': `198.51.100.${Math.floor(Math.random() * 250)}` });
const fields = async () => ({ _ts: await formTimingToken(Date.now() - 5000), website: '' });
const ctx = async () => ({ headers: headers(), fields: await fields() });
const post = { entityType: 'post', entityId: 'ent_1' };
const newUser = async (name: string) =>
  upsertOAuthUser('github', { id: String(Math.random()), email: null, emailVerified: false, name, avatarUrl: null });
const code = (p: Promise<unknown>) => p.then(() => 'ok', (e) => (e instanceof CommentError ? e.code : Promise.reject(e)));

beforeEach(async () => {
  db = await testDb(authSchema, antispamSchema, jobsSchema, schema);
  sent.length = 0;
  setEmailProvider({ name: 'test', send: async (m) => (sent.push(m), { id: null }) });
  Object.assign(process.env, { ANTISPAM_SECRET: 'a'.repeat(40), AUTH_SECRET: 'x'.repeat(40), EMAIL_FROM: 'Blog <b@b.test>', COMMENTS_NOTIFY_TO: 'mod@b.test' });
  delete process.env.TURNSTILE_SECRET_KEY;
});

describe('posting and moderation', () => {
  it('guests go to moderation (and notify moderators); approved ones are listed with replies', async () => {
    const c = await postComment({ ...post, body: 'Great post!', guest: { name: 'Eve', email: 'Eve@x.test' } }, await ctx());
    expect(c).toMatchObject({ status: 'pending', authorName: 'Eve', authorId: null });
    expect(c.guestEmailHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(c)).not.toContain('Eve@x.test');
    await runDue();
    expect(sent[0]).toMatchObject({ to: ['mod@b.test'] });
    expect((await listComments('post', 'ent_1')).total).toBe(0);
    await moderate(c.id, 'approve');
    const u = await newUser('Ana');
    const reply = await postComment({ ...post, parentId: c.id, body: 'Thanks!', user: { id: u.id, name: u.name } }, await ctx());
    expect(reply.status).toBe('pending'); // usuario sin historial aprobado
    await moderate(reply.id, 'approve');
    const second = await postComment({ ...post, body: 'Me again', user: { id: u.id, name: u.name } }, await ctx());
    expect(second.status).toBe('approved'); // ya tiene uno aprobado
    const list = await listComments('post', 'ent_1', { order: 'oldest' });
    expect(list.total).toBe(2);
    expect(list.comments[0]).toMatchObject({ body: 'Great post!', replies: [{ body: 'Thanks!', authorName: 'Ana' }] });
    expect(JSON.stringify(list)).not.toContain('guestEmailHash');
  });

  it('validates input, parents and anti-spam', async () => {
    expect(await code(postComment({ ...post, body: 'x', guest: { name: 'E', email: 'e@x.test' } }, await ctx()))).toBe('invalid');
    expect(await code(postComment({ ...post, body: 'Hello', guest: { name: 'E', email: 'nope' } }, await ctx()))).toBe('invalid');
    expect(await code(postComment({ ...post, body: 'Hello', guest: { name: 'E', email: 'e@x.test' } }, { headers: headers(), fields: {} }))).toBe('spam');
    const pending = await postComment({ ...post, body: 'Hello', guest: { name: 'E', email: 'e@x.test' } }, await ctx());
    expect(await code(postComment({ ...post, parentId: pending.id, body: 'Reply', guest: { name: 'F', email: 'f@x.test' } }, await ctx()))).toBe('invalid');
    await moderate(pending.id, 'approve');
    expect(await code(postComment({ entityType: 'post', entityId: 'other', parentId: pending.id, body: 'Reply', guest: { name: 'F', email: 'f@x.test' } }, await ctx()))).toBe('invalid');
    expect(await code(postComment({ entityType: 'Bad Type', entityId: '1', body: 'Hello', guest: { name: 'F', email: 'f@x.test' } }, await ctx()))).toBe('invalid');
  });

  it('bans by comment author and marks their pending comments as spam', async () => {
    const c1 = await postComment({ ...post, body: 'Buy pills', guest: { name: 'S', email: 'spam@x.test' } }, await ctx());
    await postComment({ ...post, body: 'Buy more', guest: { name: 'S', email: 'SPAM@x.test' } }, await ctx());
    await ban({ commentId: c1.id }, 'spam');
    expect((await db.select().from(comments)).map((c) => c.status)).toEqual(['spam', 'spam']);
    expect(await code(postComment({ ...post, body: 'Again', guest: { name: 'S', email: 'spam@x.test' } }, await ctx()))).toBe('banned');
    const u = await newUser('Troll');
    await ban({ userId: u.id });
    expect(await code(postComment({ ...post, body: 'Hi there', user: { id: u.id, name: 'Troll' } }, await ctx()))).toBe('banned');
  });
});

describe('ratings, html and privacy', () => {
  it('summarizes approved ratings only', async () => {
    for (const r of [5, 4, 4, 1]) {
      const c = await postComment({ entityType: 'product', entityId: 'prd_1', body: 'Review text', rating: r, guest: { name: 'G', email: `${r}${Math.random()}@x.test` } }, await ctx());
      if (r !== 1) await moderate(c.id, 'approve');
    }
    expect(await ratingSummary('product', 'prd_1')).toEqual({ count: 3, average: 4.33, histogram: [0, 0, 0, 2, 1] });
    expect(await ratingSummary('product', 'none')).toEqual({ count: 0, average: 0, histogram: [0, 0, 0, 0, 0] });
  });

  it('renders safe HTML with ugc links', () => {
    expect(commentHtml('<script>alert(1)</script>\nsee https://x.test/a?b=1&c=2.')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;<br>see <a href="https://x.test/a?b=1&amp;c=2" rel="nofollow ugc noopener" target="_blank">https://x.test/a?b=1&amp;c=2</a>.',
    );
    expect(commentHtml('javascript:alert(1)')).toBe('javascript:alert(1)');
  });

  it('erases by guest email or user', async () => {
    await postComment({ ...post, body: 'Mine', guest: { name: 'G', email: 'gdpr@x.test' } }, await ctx());
    expect(await eraseComments({ email: ' GDPR@x.test ' })).toBe(1);
    const u = await newUser('U');
    await postComment({ ...post, body: 'Mine too', user: { id: u.id, name: 'U' } }, await ctx());
    expect(await eraseComments({ userId: u.id })).toBe(1);
  });
});

describe('admin and routes', () => {
  const admin = (perms: string[]): AdminContext => ({ user: { id: 'usr_1', email: null, name: null }, can: async (p) => perms.includes(p) });

  it('moderation queue and actions need permissions', async () => {
    const c = await postComment({ ...post, body: 'Queue me', guest: { name: 'Q', email: 'q@x.test' } }, await ctx());
    const mod = admin(['comments:read', 'comments:moderate']);
    expect((await commentsAdminResource.list({ page: 1, pageSize: 10 }, mod)).total).toBe(1);
    const approve = commentsAdminResource.actions!.find((a) => a.name === 'approve')!;
    expect(await code(approve.run(c.id, {}, admin(['comments:read'])))).toBe('forbidden');
    expect((await approve.run(c.id, {}, mod)).status).toBe('approved');
    expect((await commentsAdminResource.list({ page: 1, pageSize: 10 }, mod)).total).toBe(0);
  });

  it('Hono and Next endpoints post as guest or user and list approved', async () => {
    const u = await newUser('Logged');
    const currentUser = async (req: Request) => (req.headers.get('x-user') ? { id: u.id, name: 'Logged' } : null);
    const app = new Hono().route('/api/comments', commentRoutes({ currentUser, moderation: 'none' }));
    const body = JSON.stringify({ ...(await fields()), body: 'From a guest', name: 'G', email: 'g@x.test' });
    const res = await app.request('/api/comments/post/ent_9', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.1' }, body });
    expect(res.status).toBe(201);
    expect(((await (await app.request('/api/comments/post/ent_9')).json()) as { total: number }).total).toBe(1);
    const { POST, GET } = commentRoute({ currentUser, moderation: 'none' });
    const fd = new FormData();
    for (const [k, v] of Object.entries({ ...(await fields()), body: 'From a user' })) fd.set(k, String(v));
    const r = await POST(new Request('http://x', { method: 'POST', body: fd, headers: { 'x-user': '1', 'x-forwarded-for': '203.0.113.2' } }), { params: Promise.resolve({ type: 'post', id: 'ent_9' }) });
    expect(r.status).toBe(201);
    const bad = await POST(new Request('http://x', { method: 'POST', body: new FormData() }), { params: Promise.resolve({ type: 'post', id: 'ent_9' }) });
    expect(bad.status).toBe(400);
    expect(((await (await GET(new Request('http://x'), { params: Promise.resolve({ type: 'post', id: 'ent_9' }) })).json()) as { total: number }).total).toBe(2);
    // Formulario HTML sin JavaScript: vuelve a la página (mismo origen) con el resultado.
    const html = new FormData();
    for (const [k, v] of Object.entries({ ...(await fields()), body: 'Plain HTML post', name: 'H', email: 'h@x.test' })) html.set(k, String(v));
    const back = await POST(new Request('http://x.test/api/comments/post/ent_9', { method: 'POST', body: html, headers: { accept: 'text/html', referer: 'http://x.test/blog/hello', 'x-forwarded-for': '203.0.113.3' } }), { params: Promise.resolve({ type: 'post', id: 'ent_9' }) });
    expect(back.status).toBe(303);
    expect(back.headers.get('location')).toBe('http://x.test/blog/hello?comment=approved#comments');
    const spam = await POST(new Request('http://x.test/api/comments/post/ent_9', { method: 'POST', body: new FormData(), headers: { accept: 'text/html', referer: 'http://x.test/blog/hello' } }), { params: Promise.resolve({ type: 'post', id: 'ent_9' }) });
    expect(spam.headers.get('location')).toBe('http://x.test/blog/hello?comment=spam#comments');
  });
});
