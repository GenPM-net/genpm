import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Subscription confirmed', robots: { index: false, follow: false } };

export default function Page() {
  return (
    <main className="blk">
      <h1>Subscription confirmed</h1>
      <p>Thank you! You will receive our next emails.</p>
      <p>
        <a href="/blog">Back to the blog</a>
      </p>
    </main>
  );
}
