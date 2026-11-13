---
title: Stripe sent the same webhook twice
description: Stripe delivers events at least once, so your handler will run twice on the same event. The fix is an event table written inside the same transaction as the business data.
pkg: @core/stripe
published: 2026-11-13
updated: 2026-11-13
order: 10
---
A customer pays once and ends up with two subscription rows. Or two welcome emails. Or twice the credits. You open the logs and there are two `POST /api/stripe/webhook` entries, seconds apart, carrying the same event id:

```
POST /api/stripe/webhook 200  evt_1Q8xkT2eZvKYlo2C  checkout.session.completed
POST /api/stripe/webhook 200  evt_1Q8xkT2eZvKYlo2C  checkout.session.completed
```

Same `evt_…`, two runs, two sets of side effects. Nothing is broken in Stripe and nothing is broken in your network: this is the documented delivery contract, and your handler has to absorb it.

## Why the same event arrives more than once

Stripe webhooks are **at-least-once** delivery. An event is re-delivered when:

- Your endpoint answered with a non-2xx status, so Stripe retries with backoff.
- Your endpoint did not answer in time. The work may have completed anyway — the response was simply lost — and Stripe cannot tell the difference.
- You (or a colleague) hit *Resend* in the Stripe dashboard, or replayed events after fixing a bug.
- You have more than one endpoint subscribed to the same event, or both a test and a live endpoint pointing at the same host.
- Two events describe the same state change. `checkout.session.completed` and `customer.subscription.created` both tell you a subscription now exists.

The last one matters: deduplicating by event id is necessary but does not make your business logic idempotent on its own. Two *different* event ids can ask for the same write.

## What does not work

**Checking first.** `if (await findSubscription(customerId)) return;` reads, then writes. Two concurrent deliveries both read "nothing there" and both insert. The window is milliseconds wide and you will hit it, because retries often arrive in bursts.

**An in-memory set of seen ids.** It dies with the process, and on a serverless host each instance has its own. Two instances, two sets, two runs.

**A Redis `SETNX` lock.** Better, but the lock and the data live in different systems with separate failure modes. The write can commit while the lock expires, or the lock can be taken while the write rolls back. You now have two sources of truth about whether the event was processed.

**Upserting on a natural key.** `insert … on conflict (customer_id) do update` makes *that one row* idempotent. It does nothing for the email you send, the credits you grant or the third-party call you make in the same handler.

## The fix: claim the event in the same transaction as the write

Keep a table whose primary key is the Stripe event id, and insert the row **inside the transaction that does the real work**. The database decides, once, who gets to process the event:

```sql
create table stripe_events (
  id         text primary key,
  type       text not null,
  created_at timestamptz not null default now()
);
```

```ts
// app/api/stripe/webhook/route.ts  (Next.js App Router)
import Stripe from 'stripe';
import { pool } from '@/lib/db';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  // The signature covers the raw bytes. Never req.json() before verifying.
  const raw = await req.text();
  const signature = req.headers.get('stripe-signature');
  if (!signature) return new Response('missing signature', { status: 400 });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      raw,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    // A bad signature is never worth retrying: answer 400 and stop.
    return new Response(`invalid signature: ${(err as Error).message}`, { status: 400 });
  }

  const db = await pool.connect();
  try {
    await db.query('begin');

    const claim = await db.query(
      `insert into stripe_events (id, type) values ($1, $2)
       on conflict (id) do nothing`,
      [event.id, event.type],
    );

    if (claim.rowCount === 0) {
      // Someone already processed this event, or is processing it right now.
      await db.query('rollback');
      return new Response('duplicate', { status: 200 });
    }

    await handle(event, db);

    await db.query('commit');
  } catch (err) {
    await db.query('rollback');
    console.error('webhook failed', event.id, event.type, err);
    // 500 asks Stripe to deliver it again. The claim row rolled back with the work.
    return new Response('retry', { status: 500 });
  } finally {
    db.release();
  }

  return new Response(null, { status: 204 });
}
```

Three properties make this work, and all three come from putting the claim and the work in one transaction:

1. **A duplicate loses the insert.** The primary key conflict is resolved by Postgres, not by your code reading first.
2. **A concurrent duplicate blocks, then loses.** The second transaction waits on the uncommitted key until the first commits, then sees the conflict and does nothing.
3. **A failure leaves no trace.** If `handle` throws, the rollback removes the claim too, so Stripe's retry gets a clean attempt. An event table written *before* the transaction would permanently mark a failed event as done.

## Side effects that are not database writes

A transaction cannot roll back an email. So do not send it inside the handler — write a row that says it should be sent, in the same transaction, and let a worker pick it up:

```ts
async function handle(event: Stripe.Event, db: PoolClient) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      await db.query(
        `insert into subscriptions (user_id, stripe_customer_id, status)
         values ($1, $2, 'active')
         on conflict (user_id) do update set status = 'active'`,
        [session.client_reference_id, session.customer],
      );
      // Queued, not sent: if the transaction rolls back, the job is gone with it.
      await db.query(
        `insert into jobs (type, payload) values ('email.welcome', $1)`,
        [{ userId: session.client_reference_id }],
      );
      return;
    }
    default:
      return; // Unhandled types are still claimed and still answered 200.
  }
}
```

That worker will also run jobs more than once, for the same reason — queues are at-least-once too — so the welcome email needs its own idempotency key. One habit covers both: every handler must be safe to run twice.

## Events also arrive out of order

Delivery order is not guaranteed. `customer.subscription.updated` saying *past_due* can land after the one saying *active*, leaving you with a stale status. Two defences:

- When order matters, re-read the object from the API inside the handler instead of trusting the payload: `await stripe.subscriptions.retrieve(id)` returns the current state.
- Or store `event.created` per entity and ignore events older than the one you already applied.

## Answer fast, verify with a replay

Keep the handler short. Everything slow — a provisioning call, a PDF, a Slack message — belongs in the queue, not in the request. Stripe retries slow endpoints, which is exactly how you get the duplicates you just fixed.

To test it properly, replay a real event instead of sending a new one:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
stripe trigger checkout.session.completed
```

Then open the event in the dashboard and press *Resend*. The second delivery must answer 200 and change nothing: one row in `stripe_events`, one subscription, one queued email. If the count moved, something in the handler is still outside the transaction.

## If you would rather not maintain this

`@core/stripe` is this exact shape as source code you own: one signature-verified endpoint, a `stripe_events` table, and a dispatch step that runs every module's handlers inside a single transaction, so a throwing handler rolls everything back and Stripe retries. Handlers register with `onStripeEvent` and receive the transaction they must write through.

```bash
genpm add @core/stripe
```

It installs into `src/lib/stripe` in your repo — not into `node_modules` — with adapters for Hono and Next.js and an `AGENTS.md` your coding agent reads before touching it. Without the CLI installed: `npx -y @genpm-net/cli add @core/stripe`.
