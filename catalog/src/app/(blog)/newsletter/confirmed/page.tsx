import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Subscription confirmed', robots: { index: false, follow: false } };

export default function Page() {
  return (
    <main className="blk">
      <h1>Subscription confirmed</h1>
      <p>Thank you! You will receive our next emails.</p>
      <p>
        <Link href="/blog">Back to the blog</Link>
      </p>
    </main>
  );
}
