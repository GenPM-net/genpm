import { Cta } from '@/components/cta';

export default function Home() {
  return (
    <main>
      <section className="hero">
        <h1>Plumbing done right, the first time</h1>
        <p>Leaks, boilers and bathroom renovations in Valencia. Same-day visits, fixed prices.</p>
        <img src="/img/van.svg" alt="Our blue van parked outside a client's house" width={480} height={240} />
      </section>
      <section className="features">
        <h2>Why neighbours call us</h2>
        <ul>
          <li><h3>Same-day visits</h3><p>Call before noon and we are there today.</p></li>
          <li><h3>Fixed prices</h3><p>You know the price before we start.</p></li>
          <li><h3>2-year guarantee</h3><p>On every repair and installation.</p></li>
        </ul>
      </section>
      <Cta title="Got a leak?" text="We answer the phone 7 days a week." label="Book a visit" href="/contact" />
    </main>
  );
}
