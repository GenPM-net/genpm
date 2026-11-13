---
title: SignatureDoesNotMatch on a presigned S3 upload
description: A presigned PUT fails when the browser sends a header the signature did not cover, or a different content type. Read SignedHeaders from the URL, sign exactly what the browser will send, and check the object afterwards.
pkg: @core/storage
published: 2026-11-13
updated: 2026-11-13
order: 30
---
The server hands the browser a presigned URL, the browser `PUT`s the file, and S3 (or R2, or MinIO) answers 403 with:

```xml
<Error>
  <Code>SignatureDoesNotMatch</Code>
  <Message>The request signature we calculated does not match the signature you provided.</Message>
</Error>
```

Or worse, the browser console shows only a CORS error and no status at all, because the preflight never got a chance to succeed. Both symptoms usually have the same cause, and the error message is honest: the request that arrived is not the request that was signed.

## What SigV4 actually signs

A presigned URL is a signature over a canonical description of the request: the HTTP method, the path, the query parameters, **a declared list of headers**, and a payload hash. The declared list is right there in the URL:

```
https://bucket.s3.eu-west-1.amazonaws.com/uploads/01JC.../photo.jpg
  ?X-Amz-Algorithm=AWS4-HMAC-SHA256
  &X-Amz-Credential=...
  &X-Amz-Date=20261113T101500Z
  &X-Amz-Expires=600
  &X-Amz-SignedHeaders=content-type%3Bhost
  &X-Amz-Signature=...
```

`X-Amz-SignedHeaders=content-type;host` is the contract. The request must carry those headers, with exactly those values. Anything missing, extra *in that list*, or spelled differently and the recomputed signature differs.

So the first debugging step is not to read your code — it is to decode `X-Amz-SignedHeaders` from the failing URL and compare it with what the request actually sends, in the browser's network tab.

## The four things that usually differ

**1. The browser set a content type you did not sign.** This is the most common one. `fetch(url, { method: 'PUT', body: file })` with no headers does not send no content type — the browser derives one from the `File`, and it will not always equal what your server signed. Sometimes it is `application/octet-stream`, sometimes it is the type with a charset appended. Always send the header explicitly, with the same string the server signed:

```ts
const { url, contentType } = await fetch('/api/uploads', {
  method: 'POST',
  body: JSON.stringify({ name: file.name, type: file.type, size: file.size }),
}).then((r) => r.json());

const res = await fetch(url, {
  method: 'PUT',
  headers: { 'content-type': contentType }, // the value the server signed, not file.type
  body: file,
});
if (!res.ok) throw new Error(`upload failed: ${res.status} ${await res.text()}`);
```

Returning the content type alongside the URL, instead of letting the client guess it twice, removes the whole class of mismatch.

**2. You signed a header the browser is not allowed to set.** `content-length` is a forbidden header name in `fetch`: the browser computes and sends it, but your code cannot set it, and some SDKs include it in `SignedHeaders` when you pass a length. If `SignedHeaders` contains anything other than `content-type` and `host`, ask yourself whether the browser can really produce it.

**3. Something added an extra signed header.** Checksum and integrity headers are the usual suspects: an SDK that adds one when it builds the presigned request will list it in `SignedHeaders`, and the browser will not send it. The check is the same — decode `SignedHeaders`, compare, and remove from the presigning call whatever the browser cannot reproduce.

**4. The URL is simply expired, or the clocks disagree.** `X-Amz-Date` plus `X-Amz-Expires` is an absolute window. A URL presigned at page load and used after the user picked a 200 MB file over a slow connection can expire mid-upload; a container with a drifted clock signs requests that are not valid yet. The error for an expired URL is usually `AccessDenied` / `Request has expired` rather than `SignatureDoesNotMatch`, which is itself a useful distinction.

## Isolating CORS from signing

Browsers report a 403 with no CORS headers as a CORS error, which hides the real failure. Take the browser out of the loop and replay the exact request with curl:

```bash
curl -i -X PUT "$PRESIGNED_URL" \
  -H "content-type: image/jpeg" \
  --data-binary @photo.jpg
```

- curl succeeds, browser fails → it is CORS, or a header the browser adds.
- curl fails too → it is the signature, and the response body names the reason.

The bucket needs a CORS rule that allows the method, your origin and the `content-type` request header:

```json
[{
  "AllowedOrigins": ["https://app.example.com", "http://localhost:3000"],
  "AllowedMethods": ["PUT", "GET"],
  "AllowedHeaders": ["content-type"],
  "ExposeHeaders": ["etag"],
  "MaxAgeSeconds": 3600
}]
```

`ExposeHeaders: ["etag"]` is only needed if you read the ETag from the response in JavaScript — without it the header is invisible to your code even though it arrived.

## Presigning on the server

```ts
// app/api/uploads/route.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ulid } from 'ulid';

const s3 = new S3Client({
  region: process.env.STORAGE_REGION ?? 'auto',
  endpoint: process.env.STORAGE_ENDPOINT, // R2: https://<account>.r2.cloudflarestorage.com
  credentials: {
    accessKeyId: process.env.STORAGE_ACCESS_KEY_ID!,
    secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY!,
  },
});

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 10_000_000;

export async function POST(req: Request) {
  const user = await requireUser(req);
  const { name, type, size } = await req.json();

  if (!ALLOWED.has(type)) return new Response('unsupported type', { status: 415 });
  if (!Number.isInteger(size) || size <= 0 || size > MAX_BYTES) {
    return new Response('too large', { status: 413 });
  }

  // The server owns the key. Never the user's filename.
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[type as string];
  const key = `uploads/pending/${user.id}/${ulid()}.${ext}`;

  const url = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: process.env.STORAGE_BUCKET!, Key: key, ContentType: type }),
    { expiresIn: 600 },
  );

  return Response.json({ url, key, contentType: type });
}
```

Two decisions in there are worth stating out loud.

**The key is generated server-side.** Using `name` from the request lets a client write `../../avatars/someone-else.jpg`, or simply overwrite another user's object by guessing their key. Generate an opaque id and store the key in your table next to the row that owns it — store the key, not the URL, because URLs change the day you put a CDN in front of the bucket.

**The size check in that handler is advisory.** The client said 10 KB; nothing stops it from uploading 2 GB to a URL signed without a length constraint. If you need a hard cap, either use a presigned **POST** policy, which supports a `content-length-range` condition the storage service itself enforces, or treat the upload as untrusted until the server has confirmed it:

```ts
import { HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const head = await s3.send(new HeadObjectCommand({ Bucket, Key: key }));
if ((head.ContentLength ?? 0) > MAX_BYTES) {
  await s3.send(new DeleteObjectCommand({ Bucket, Key: key }));
  throw new Error('upload exceeded the limit');
}
```

That confirmation step is also where you stop trusting the content type. The client declared `image/png`; only the bytes can prove it. Sniff the magic number server-side before you move the object from `uploads/pending/` to the key you will serve publicly, and keep everything private by default — serve private objects with a short-lived presigned `GET` issued *after* an authorization check, not by making the bucket public.

## If you would rather not maintain this

`@core/storage` is one `StorageProvider` interface over S3-compatible buckets — R2, S3, MinIO, B2 — signed with SigV4 through `aws4fetch`, so the same code runs on Node and on Cloudflare Workers. It presigns uploads with the content type and size signed, generates safe keys (`generateKey`, `assertSafeKey`), and ships `local` and `memory` drivers so uploads work in development and in tests without a bucket.

```bash
genpm add @core/storage
```

It installs into `src/lib/storage` in your repo, with adapters for Hono and Next.js. Without the CLI installed: `npx -y @genpm-net/cli add @core/storage`.
