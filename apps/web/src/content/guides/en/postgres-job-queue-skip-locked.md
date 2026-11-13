---
title: Two workers picked up the same job
description: A select-then-update queue hands the same row to two workers. One statement with FOR UPDATE SKIP LOCKED claims a job atomically, and a lock expiry keeps a dead worker from pinning it forever.
pkg: @core/jobs
published: 2026-11-13
updated: 2026-11-13
order: 20
---
You added a second worker to clear a backlog and the duplicates started immediately: the same welcome email twice, the same invoice generated twice, the same webhook delivered twice. The logs show one job id claimed by two processes in the same second:

```
worker-1  claim job 8421 email.welcome
worker-2  claim job 8421 email.welcome
```

With one worker the bug was invisible. With two it is constant, because the queue never actually claimed anything.

## Why select-then-update hands out the same row

The usual first version is two statements:

```sql
select id, type, payload from jobs
 where status = 'pending' and run_at <= now()
 order by run_at limit 1;

update jobs set status = 'running' where id = $1;
```

A plain `select` takes no row lock. Between the two statements any other worker runs the same `select` and reads the same row, because it is still `pending`. Both then run the `update`, and the second one happily overwrites a status that is already `running`.

Wrapping both statements in a transaction does not help. Transactions give you atomicity and isolation of *writes*; in the default `read committed` isolation level a `select` without `for update` still reads a snapshot and still blocks nobody.

## Why `FOR UPDATE` alone is the wrong fix

Adding `for update` makes it correct and unusable:

```sql
select id from jobs where status = 'pending' order by run_at limit 1 for update;
```

Worker 2 now **waits** on the row that worker 1 locked. When worker 1 commits, worker 2 re-evaluates the row, sees `status = 'running'`, and gets nothing back — correct, but it spent the whole time blocked on a row it was never going to get. With *n* workers you have serialised the queue: every worker queues up behind the same first row. Throughput does not improve when you add workers; it gets worse.

## The fix: claim in one statement with SKIP LOCKED

`skip locked` tells Postgres to ignore rows that are already locked by someone else instead of waiting for them. Combined with a CTE, the claim becomes a single atomic statement — each worker gets a different row, nobody blocks:

```sql
with claimed as (
  select id
    from jobs
   where status = 'pending'
     and run_at <= now()
   order by run_at
     for update skip locked
   limit $1                      -- batch size, e.g. 4
)
update jobs j
   set status       = 'running',
       attempt      = j.attempt + 1,
       locked_until = now() + interval '5 minutes',
       locked_by    = $2         -- worker id, for debugging
  from claimed c
 where j.id = c.id
returning j.id, j.type, j.payload, j.attempt;
```

There is no gap for a second worker to slip into: the rows are locked by the `select` and updated by the same statement, in the same transaction. Ask for four jobs with eight workers running and each worker gets four different jobs.

Give it an index that matches the predicate, or the claim will scan the whole table once the queue grows:

```sql
create index jobs_pending_idx on jobs (run_at) where status = 'pending';
```

A partial index is the right shape here: it only contains the rows the claim query looks at, so it stays small even with millions of finished jobs in the table.

## When the worker dies mid-job

A claimed job is `running` with nobody running it. Without a timeout it stays that way forever. That is what `locked_until` is for — a reaper puts expired rows back:

```sql
update jobs
   set status = 'pending',
       run_at = now()
 where status = 'running'
   and locked_until < now();
```

One detail decides whether this is a safety net or an infinite loop: **an expired lock must count as an attempt**. The claim statement above already incremented `attempt`, so a job that reliably kills its worker — out of memory, a segfault in a native dependency — runs out of attempts and is marked `failed` instead of being reclaimed forever by every new worker you start.

```sql
update jobs
   set status     = 'failed',
       last_error = 'lock expired'
 where status = 'running'
   and locked_until < now()
   and attempt >= max_attempts;
```

## Retries that back off

Retrying a failing job immediately turns a broken third-party API into a tight loop against it. Push `run_at` into the future, growing with the attempt count and capped:

```sql
update jobs
   set status     = 'pending',
       last_error = $2,
       run_at     = now() + least(
                      interval '1 hour',
                      interval '1 second' * power(2, attempt)
                    )
 where id = $1;
```

Attempt 1 waits two seconds, attempt 5 waits about half a minute, attempt 12 and beyond waits an hour.

## Handlers still have to be idempotent

`SKIP LOCKED` removes concurrent double-claims. It does not make delivery exactly-once, and nothing in a queue can: a worker that finishes the work and dies before committing the `done` status will have its lock expire and the job will run again. Plan for at-least-once. Carry an id in the payload and make the write conditional, instead of appending blindly:

```ts
await db.query(
  `insert into emails (user_id, kind) values ($1, 'welcome')
   on conflict (user_id, kind) do nothing`,
  [userId],
);
```

Keep payloads small — ids and a handful of scalars — and load the current data inside the handler. A payload serialised an hour ago is a snapshot of an hour ago, and a payload is also the worst place to keep a secret, since it sits in a table and shows up in every debugging query.

## Enqueueing the same job once

The "send a digest when this user's cart changes" job should not pile up ten rows if the cart changed ten times. A unique partial index on a dedupe key is enough:

```sql
create unique index jobs_dedupe_idx on jobs (dedupe_key)
  where status in ('pending', 'running');
```

Enqueue with `on conflict do nothing` and the second attempt is a no-op while one is still pending, and allowed again once the first finished.

## Serverless: no worker to run

On Vercel, Netlify or Workers there is no long-running process to loop in. Expose an authenticated endpoint that drains due jobs and let the platform's cron call it every minute:

```ts
// app/api/cron/route.ts
export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('unauthorized', { status: 401 });
  }
  const ran = await runDue({ budgetMs: 50_000 });
  return Response.json({ ran });
}
```

Two cron invocations overlapping is harmless — that is the whole point of `SKIP LOCKED`, the second one simply claims different rows. Keep a time budget below the platform's request limit so the function returns instead of being killed mid-job, and never expose the endpoint without the secret: it is a remote "run arbitrary queued work now" button.

## If you would rather not maintain this

`@core/jobs` is this queue as source code in your repo: `FOR UPDATE SKIP LOCKED` claims, exponential backoff, timeouts with `AbortSignal`, dedupe keys, cron schedules with timezones, and the serverless cron endpoint above. It lives on the Postgres you already have — no Redis, no extra service.

```bash
genpm add @core/jobs
```

Jobs are defined with a Zod-validated payload, so `enqueue` is type-checked against the handler:

```ts
export const sendWelcome = defineJob(
  'email.welcome',
  z.object({ userId: z.string() }),
  async ({ userId }, { signal }) => { /* … */ },
);

await sendWelcome.enqueue({ userId }, { dedupeKey: `welcome:${userId}` });
```

It installs into `src/lib/jobs`, with adapters for Hono and Next.js. Without the CLI installed: `npx -y @genpm-net/cli add @core/jobs`.
