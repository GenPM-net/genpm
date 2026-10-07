// Información obligatoria antes de pagar en dropshipping: plazo real del proveedor, país de origen, devoluciones e
// impuestos de importación. Añádelo también a la ficha de producto de kit-store (`<DeliveryNotice product={p} />`).
import { eq, inArray } from 'drizzle-orm';
import type { ProductView } from '@/lib/catalog';
import { getDb } from '@/lib/db';
import { supplierProducts, suppliers } from '@/lib/suppliers';
import Link from 'next/link';

export async function DeliveryNotice({ product }: { product: Pick<ProductView, 'variants'> }) {
  const ids = product.variants.map((v) => v.id);
  if (!ids.length) return null;
  const rows = await getDb()
    .select({ min: supplierProducts.shippingDaysMin, max: supplierProducts.shippingDaysMax, config: suppliers.config })
    .from(supplierProducts)
    .innerJoin(suppliers, eq(suppliers.id, supplierProducts.supplierId))
    .where(inArray(supplierProducts.variantId, ids));
  if (!rows.length) return null;
  const min = Math.min(...rows.map((r) => r.min ?? Number.POSITIVE_INFINITY));
  const max = Math.max(...rows.map((r) => r.max ?? 0));
  const from = [...new Set(rows.map((r) => r.config.shipsFrom).filter(Boolean))];
  const names = new Intl.DisplayNames(['en'], { type: 'region' });
  const country = from.map((c) => names.of(c!) ?? c).join(', ');
  return (
    <aside className="ui-alert drop-notice" aria-label="Delivery and returns">
      {Number.isFinite(min) && max > 0 && (
        <p>
          <strong>Delivery:</strong> {min}–{max} business days after shipping{country && <> from {country}</>}.
        </p>
      )}
      {from.some((c) => c && !EU.has(c)) && <p>Shipped from outside the EU: import VAT or duties may apply depending on your country.</p>}
      <p>
        You buy from this shop, which handles your order, returns and the 14-day right of withdrawal. <Link href="/returns">Returns policy</Link>.
      </p>
    </aside>
  );
}

const EU = new Set(['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE']);
