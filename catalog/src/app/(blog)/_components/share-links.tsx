// Compartir con enlaces normales: sin scripts ni cookies de terceros.
export function ShareLinks({ url, title }: { url: string; title: string }) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  const links = [
    { name: 'X', href: `https://x.com/intent/post?url=${u}&text=${t}` },
    { name: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
    { name: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { name: 'Email', href: `mailto:?subject=${t}&body=${u}` },
  ];
  return (
    <nav aria-label="Share this post" className="blog-share">
      <span>Share:</span>
      {links.map((l) => (
        <a key={l.name} href={l.href} rel="noopener noreferrer" target={l.name === 'Email' ? undefined : '_blank'}>
          {l.name}
        </a>
      ))}
    </nav>
  );
}
