// RFC 9116. Caduca a los 12 meses: renovar en cada release anual (security §9).
import type { APIRoute } from 'astro';

export const GET: APIRoute = () =>
  new Response(
    [
      'Contact: mailto:hello@genpm.net?subject=%5BSECURITY%5D',
      'Contact: https://github.com/genpm-net/genpm/security/advisories/new',
      'Expires: 2027-10-01T00:00:00.000Z',
      'Preferred-Languages: en, es, pt',
      'Canonical: https://genpm.net/.well-known/security.txt',
      'Policy: https://genpm.net/security',
      '',
    ].join('\n'),
    { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=86400' } },
  );
