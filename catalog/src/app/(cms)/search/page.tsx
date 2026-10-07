// Resultados de la búsqueda del sitio (@core/search). Sin JavaScript: formulario GET.
import type { Metadata } from 'next';
import '@/genpm';
import { search } from '@/lib/search';

export const metadata: Metadata = { title: 'Search', robots: { index: false, follow: true } };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.slice(0, 200) ?? '';
  const { hits, fuzzy } = q ? await search(q, { limit: 20 }) : { hits: [], fuzzy: false };
  return (
    <main className="blk">
      <h1>Search</h1>
      <form role="search" method="get" action="/search">
        <label htmlFor="q" className="ui-visually-hidden">
          Search
        </label>
        <input id="q" name="q" type="search" className="ui-input" defaultValue={q} />
        <button type="submit" className="ui-button ui-button--primary">
          Search
        </button>
      </form>
      {q && (
        <p aria-live="polite">
          {hits.length} results{fuzzy ? ' (similar matches)' : ''} for “{q}”
        </p>
      )}
      <ol>
        {hits.map((h) => (
          <li key={`${h.type}:${h.id}`}>
            <a href={h.url}>{h.title}</a>
            <p>{h.snippet.map((s, i) => (s.match ? <mark key={i}>{s.text}</mark> : <span key={i}>{s.text}</span>))}</p>
          </li>
        ))}
      </ol>
    </main>
  );
}
