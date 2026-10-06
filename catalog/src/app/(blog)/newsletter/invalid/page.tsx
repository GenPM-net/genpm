import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'This link is not valid', robots: { index: false, follow: false } };

export default function Page() {
  return (
    <main className="blk">
      <h1>This link is not valid</h1>
      <p>It may have expired or been used already. Subscribe again from the blog.</p>
      <p>
        <a href="/blog">Back to the blog</a>
      </p>
    </main>
  );
}
