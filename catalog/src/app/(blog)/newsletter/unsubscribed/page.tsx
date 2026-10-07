import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'You have been unsubscribed', robots: { index: false, follow: false } };

export default function Page() {
  return (
    <main className="blk">
      <h1>You have been unsubscribed</h1>
      <p>You will not receive more emails from us. You can subscribe again at any time.</p>
      <p>
        <Link href="/blog">Back to the blog</Link>
      </p>
    </main>
  );
}
