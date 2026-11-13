---
title: to_tsquery throws a syntax error on user input
description: Postgres full-text search breaks the first time someone types an ampersand or a stray quote, because to_tsquery takes an expression, not text. websearch_to_tsquery never raises, and prefix search needs a different query.
pkg: @core/search
published: 2026-11-13
updated: 2026-11-13
order: 40
---
Your search box works for weeks and then starts returning 500s. The log is short:

```
error: syntax error in tsquery: "wifi &"
error: syntax error in tsquery: "c++"
error: syntax error in tsquery: "don't"
```

Someone typed an ampersand. Someone searched for a language with pluses in its name. Someone used an apostrophe. None of that is malformed input from a user's point of view — it is what people type into search boxes — and all of it crashes `to_tsquery`.

## Why it raises

`to_tsquery` does not take text. It takes a **tsquery expression**: a small boolean language with `&` for and, `|` for or, `!` for not, `<->` for followed-by, parentheses for grouping and `:*` for prefix matching. Passing raw user input to it is like passing raw user input to `CAST(… AS json)`: the first character that is not valid in that grammar is an error, not a word.

```sql
select to_tsquery('english', 'wifi &');
-- ERROR:  syntax error in tsquery: "wifi &"

select to_tsquery('english', 'wifi & password');
--      'wifi' & 'password'      -- fine, because this *is* an expression
```

The temptation is to sanitise with a regex — strip `&|!()<>:*'`, collapse whitespace, try again. That turns a crash into a slow leak of wrong behaviour: `c++` becomes `c`, `AT&T` becomes two words, and you will keep discovering characters for months. The real problem is the choice of function.

## The three input functions, and when each is right

Postgres ships three ways to turn a string into a `tsquery`:

| Function | Input | Raises on bad input | Behaviour |
|---|---|---|---|
| `to_tsquery` | an expression | yes | you build the operators |
| `plainto_tsquery` | text | no | ANDs every word |
| `websearch_to_tsquery` | text | no | the syntax users already know |

`plainto_tsquery` is safe but blunt: every word becomes a required term and there is no way for the user to ask for a phrase or an alternative.

`websearch_to_tsquery` is the one you almost always want for a search box. It accepts the conventions people already learned from web search engines and it never raises:

```sql
select websearch_to_tsquery('english', 'wifi &');
--      'wifi'

select websearch_to_tsquery('english', '"cookie consent" -analytics');
--      'cooki' <-> 'consent' & !'analytic'

select websearch_to_tsquery('english', 'postgres or mysql');
--      'postgr' | 'mysql'
```

Quoted phrases become adjacency, a leading `-` becomes negation, `or` becomes alternation, and anything it cannot parse it simply discards. The 500 disappears without a sanitiser.

And whichever you pick: pass the query as a **parameter**, never concatenate it into the SQL string. These functions protect you from tsquery syntax errors; they do not protect you from SQL injection, because at that point the damage is already in the statement text.

## The column, the index and the query

Store the vector instead of computing it per query, in a generated column:

```sql
alter table documents
  add column search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(body,  '')), 'B')
  ) stored;

create index documents_search_idx on documents using gin (search_vector);
```

Note the two-argument `to_tsvector('english', …)`. The one-argument form resolves the dictionary from the `default_text_search_config` session setting, which makes it non-immutable, so Postgres refuses it in a generated column or an index definition. If you ever saw *"generation expression is not immutable"*, that is why. `coalesce` matters too: concatenating a `NULL` tsvector makes the whole vector `NULL`, so a row with no body would never match anything.

`setweight` is what lets a title hit outrank a body hit later.

```sql
select d.id,
       d.title,
       ts_rank_cd(d.search_vector, q.query) as rank,
       ts_headline('english', d.body, q.query,
                   'StartSel=<<, StopSel=>>, MaxFragments=2, MinWords=8, MaxWords=24') as snippet
  from documents d,
       websearch_to_tsquery('english', $1) as q(query)
 where d.search_vector @@ q.query
 order by rank desc, d.id
 limit 20;
```

`ts_rank_cd` (cover density) takes proximity into account, so a document where the terms appear next to each other ranks above one where they are paragraphs apart. Plain `ts_rank` only counts frequency and weights.

One guard: `websearch_to_tsquery` returns an empty query for input that contains no usable words, and `search_vector @@ ''::tsquery` matches nothing. That is the behaviour you want — an empty result, not an error — but check for it before you run the query if you would rather show "type something" than zero hits.

## Snippets are not HTML

`ts_headline` wraps matches in `<b>` by default and returns the surrounding text **unescaped**. If `body` contains anything a user wrote, rendering that string with `dangerouslySetInnerHTML` or `v-html` is a stored XSS. The fix is in the query above: set `StartSel` and `StopSel` to sentinels that cannot appear in your content, then split in the application and let the framework escape each piece:

```tsx
function Snippet({ text }: { text: string }) {
  const parts = text.split(/<<|>>/);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? <mark key={i}>{part}</mark> : <span key={i}>{part}</span>,
      )}
    </>
  );
}
```

Odd indices are inside a match because `split` alternates. No raw HTML crosses the boundary, and you can style `<mark>` however you like.

## Search-as-you-type needs a different query

`websearch_to_tsquery` has no prefix operator, so typing `cook` will not find `cookie` — the stemmer reduces whole words, it does not truncate them. For an autocomplete you want the completed words treated normally and only the **last** word treated as a prefix. Build that term with `quote_literal`, which escapes embedded quotes into a valid tsquery lexeme:

```sql
-- $1 = everything before the last word, $2 = the word being typed
select websearch_to_tsquery('english', $1)
       && to_tsquery('simple', quote_literal($2) || ':*') as query;
```

`quote_literal('don''t')` produces `'don''t'`, which `to_tsquery` parses as a single lexeme instead of choking on the apostrophe. The `simple` configuration is deliberate: you do not want the prefix stemmed before it is truncated.

## Typos are a separate problem

Full-text search matches stems, not approximations: `postgers` will never find `postgres`. If you need that, add a trigram fallback that only runs when the full-text query returned nothing:

```sql
create extension if not exists pg_trgm;
create index documents_title_trgm_idx on documents using gin (title gin_trgm_ops);

select id, title from documents
 where title % $1                       -- similarity above pg_trgm.similarity_threshold
 order by similarity(title, $1) desc
 limit 10;
```

Keep it on titles. Trigram similarity over long bodies is expensive and the results are rarely what the user meant.

## One stemmer per language

`to_tsvector('english', 'corriendo')` stems with English rules and produces nonsense for a Spanish document. If your content is multilingual, store the language per row and index per language — a generated column needs a constant configuration, so that means either one partial index per language or a stored `regconfig` column plus a trigger. Whichever you choose, pass the same configuration at query time that you used at index time, or the index will not be used and the stems will not line up.

## If you would rather not maintain this

`@core/search` is this design as source code in your repo: one `search_documents` table fed by any registered source, title and body vectors weighted and stemmed per document language, prefix matching for search-as-you-type, snippets returned as plain parts (never HTML, so there is nothing to escape) and the `pg_trgm` typo fallback when the extension is present. No external engine.

```bash
genpm add @core/search
```

It installs into `src/lib/search`, with adapters for Hono and Next.js and a reindex job for `@core/jobs`. Without the CLI installed: `npx -y @genpm-net/cli add @core/search`.
