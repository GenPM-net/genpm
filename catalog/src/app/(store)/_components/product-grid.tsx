import type { ReactNode } from 'react';
import type { ProductSummary } from '@/lib/catalog';
import { ProductCard } from './product-card';
import './store.css';

export function ProductGrid(p: { title: string; intro?: ReactNode; products: ProductSummary[]; page: number; pages: number; basePath: string; query?: Record<string, string>; filters?: ReactNode }) {
  const href = (n: number) => {
    const q = new URLSearchParams({ ...(p.query ?? {}), ...(n > 1 && { page: String(n) }) });
    const s = q.toString();
    return s ? `${p.basePath}?${s}` : p.basePath;
  };
  return (
    <main className="blk store">
      <h1>{p.title}</h1>
      {p.intro}
      {p.filters}
      {p.products.length ? (
        <ul className="blk-grid blk-grid--4 store-grid" role="list">
          {p.products.map((product) => (
            <li key={product.id}>
              <ProductCard product={product} />
            </li>
          ))}
        </ul>
      ) : (
        <p>No products found.</p>
      )}
      {p.pages > 1 && (
        <nav aria-label="Pagination" className="ui-pagination">
          {p.page > 1 && (
            <a className="ui-button ui-button--sm" href={href(p.page - 1)} rel="prev">
              Previous
            </a>
          )}
          <span aria-current="page">
            Page {p.page} of {p.pages}
          </span>
          {p.page < p.pages && (
            <a className="ui-button ui-button--sm" href={href(p.page + 1)} rel="next">
              Next
            </a>
          )}
        </nav>
      )}
    </main>
  );
}
