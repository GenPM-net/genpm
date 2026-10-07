import { Cta } from '@/components/cta';

export const metadata = { title: 'Pricing · Brightside Plumbing' };

export default function Pricing() {
  return (
    <main>
      <h1>Pricing</h1>
      <table>
        <thead><tr><th>Service</th><th>From</th></tr></thead>
        <tbody>
          <tr><td>Call-out (first hour)</td><td>€45</td></tr>
          <tr><td>Boiler service</td><td>€80</td></tr>
          <tr><td>Bathroom renovation</td><td>€4,900</td></tr>
        </tbody>
      </table>
      <p className="note">Prices include VAT. Weekend call-outs +€20.</p>
      <Cta title="Need a quote?" text="Send us photos and we reply within the day." label="Ask for a quote" href="/contact" />
    </main>
  );
}
