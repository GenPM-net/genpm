import type { Metadata } from 'next';
import { listProducts, type ProductSort } from '@/lib/catalog';
import { buildMetadata } from '@/lib/seo';
import { ProductGrid } from '../_components/product-grid';
import { one, pageParam } from '../_lib/store';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const SORTS: Array<{ value: ProductSort; label: string }> = [
  { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'name', label: 'Name' },
];

export async function generateMetadata(): Promise<Metadata> {
  return (await buildMetadata({ title: 'Shop', path: '/shop' })) as Metadata;
}

export default async function Shop({ searchParams }: Props) {
  const sp = await searchParams;
  const page = pageParam(sp);
  const sort = SORTS.find((s) => s.value === one(sp.sort))?.value ?? 'newest';
  const inStock = one(sp.instock) === '1';
  const { products, pages } = await listProducts({ page, perPage: 24, sort, ...(inStock && { inStock: true }) });
  const filters = (
    <form method="get" action="/shop" className="store-filters" aria-label="Sort and filter">
      <label htmlFor="sort">Sort by</label>
      <select id="sort" name="sort" defaultValue={sort} className="ui-select">
        {SORTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <label className="ui-checkbox">
        <input type="checkbox" name="instock" value="1" defaultChecked={inStock} /> In stock only
      </label>
      <button type="submit" className="ui-button ui-button--sm">
        Apply
      </button>
    </form>
  );
  return <ProductGrid title="Shop" products={products} page={page} pages={pages} basePath="/shop" query={{ ...(sort !== 'newest' && { sort }), ...(inStock && { instock: '1' }) }} filters={filters} />;
}
