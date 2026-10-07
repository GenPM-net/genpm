import Link from 'next/link';

export function Cta({ title, text, label, href }: { title: string; text: string; label: string; href: string }) {
  return (
    <section className="cta">
      <h2>{title}</h2>
      <p>{text}</p>
      <Link className="button" href={href}>{label}</Link>
    </section>
  );
}
