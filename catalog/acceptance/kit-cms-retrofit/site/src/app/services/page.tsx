export const metadata = { title: 'Services · Brightside Plumbing' };

const services = [
  { name: 'Leak repair', text: 'Detection with thermal camera and repair without breaking more than needed.' },
  { name: 'Boilers', text: 'Installation and yearly service of gas and electric boilers.' },
  { name: 'Bathrooms', text: 'Full bathroom renovations in two weeks, tiles included.' },
  { name: 'Drains', text: 'Unblocking with high-pressure water, 24 hours.' },
];

export default function Services() {
  return (
    <main>
      <h1>Services</h1>
      <div className="grid">
        {services.map((s) => (
          <article key={s.name}>
            <h2>{s.name}</h2>
            <p>{s.text}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
