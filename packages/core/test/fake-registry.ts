// Registry falso para tests del motor: sirve /v1/resolve con manifiestos firmados con la clave de desarrollo.
import {
  archiveRecord,
  canonicalize,
  importPrivateKey,
  maxSatisfying,
  type ResolvedManifest,
  satisfies,
  sha256Hex,
  signatureHeader,
  signManifest,
} from '@genpm/manifest';

export const REGISTRY = 'http://localhost:8787';
const DEV_PRIVATE = 'MC4CAQAwBQYDK2VwBCIEIOhGZe7H5iw7JA8I_W8VqG4sSOjwdSiRocgtz-5_Er1J';

export type Pkg = Omit<ResolvedManifest, '$' | 'i' | 'x' | 'l' | 't'> & {
  $?: 1;
  i?: string;
  x?: string;
  l?: string;
  t?: string;
};

export class FakeRegistry {
  packages: ResolvedManifest[] = [];
  requests: string[] = [];
  tamper: ((m: ResolvedManifest & { sg?: string }) => void) | null = null;
  scan: Record<string, string> = {};
  /** Verified Archive (`name@version` → tar.gz); `claimHash` simula una copia manipulada (la firma no cuadra). */
  archives = new Map<string, { gz: Uint8Array; c: string; claimHash?: string }>();
  /** Lista de revocación servida en GET /v1/keys (security §4.3). */
  revocation: unknown = null;

  add(p: Pkg): this {
    this.packages.push({ $: 1, i: '.', x: 'AGENTS.md', l: 'MIT', t: `v${p.v}`, ...p } as ResolvedManifest);
    return this;
  }

  private async signed(m: ResolvedManifest) {
    const sg = await signManifest(m, 'dev1', await importPrivateKey(DEV_PRIVATE));
    const out = JSON.parse(canonicalize(m)) as ResolvedManifest & { sg?: string };
    out.sg = sg;
    this.tamper?.(out);
    return out;
  }

  pick(name: string, range: string) {
    const vs = this.packages.filter((p) => p.n === name);
    const v =
      range === 'latest'
        ? maxSatisfying(
            vs.map((p) => p.v),
            '*',
          )
        : (vs.find((p) => p.v === range)?.v ??
          maxSatisfying(
            vs.map((p) => p.v),
            range,
          ));
    return vs.find((p) => p.v === v);
  }

  fetch = async (input: string | URL | Request): Promise<Response> => {
    const url = new URL(String(input));
    this.requests.push(url.pathname + url.search);
    const ok = (b: unknown) => new Response(JSON.stringify(b), { headers: { 'content-type': 'application/json' } });
    if (url.pathname === '/v1/health') return ok({ ok: true });
    if (url.pathname === '/v1/keys') return ok({ alg: 'Ed25519', keys: [], revocation: this.revocation });
    if (url.pathname === '/v1/advisories') return ok({ advisories: [] });
    if (url.pathname === '/v1/search') {
      const q = (url.searchParams.get('q') ?? '').toLowerCase();
      const latest = new Map<string, ResolvedManifest>();
      for (const p of this.packages)
        if (!latest.has(p.n) || satisfies(p.v, `>${latest.get(p.n)!.v}`)) latest.set(p.n, p);
      const r = [...latest.values()]
        .filter(
          (p) =>
            !q ||
            p.n.includes(q) ||
            String(typeof p.s === 'string' ? p.s : (p.s?.en ?? ''))
              .toLowerCase()
              .includes(q),
        )
        .map((p) => ({
          n: p.n,
          v: p.v,
          s: typeof p.s === 'string' ? p.s : (p.s?.en ?? ''),
          k: p.k ?? [],
          i: 120,
          m: p.m?.length ? 1 : 0,
          vf: 1,
        }));
      return ok({ r, nx: null });
    }
    const ar = url.pathname.match(/^\/v1\/archive\/(@[^/]+\/[^/]+)\/([^/]+)$/);
    if (ar) {
      const a = this.archives.get(`${ar[1]}@${ar[2]}`);
      if (!a) return new Response('{}', { status: 404 });
      const h = await sha256Hex(a.gz);
      const sg = await signManifest(
        archiveRecord({ n: ar[1]!, v: ar[2]!, c: a.c, h: a.claimHash ?? h }),
        'dev1',
        await importPrivateKey(DEV_PRIVATE),
      );
      return new Response(a.gz, {
        headers: { 'genpm-archive-sha256': h, 'genpm-commit': a.c, 'genpm-archive-signature': signatureHeader(sg) },
      });
    }
    const v = url.pathname.match(/^\/v1\/packages\/(@[^/]+\/[^/]+)\/versions\/([^/]+)$/);
    if (v) {
      const p = this.packages.find((x) => x.n === v[1] && x.v === v[2]);
      return p
        ? ok({ ...(await this.signed(p)), yanked: false, yankReason: null })
        : new Response(JSON.stringify({ code: 'E_NO_MATCHING_VERSION', params: { name: v[1], range: v[2] } }), {
            status: 404,
          });
    }
    const pk = url.pathname.match(/^\/v1\/packages\/(@[^/]+\/[^/]+)$/);
    if (pk) {
      const p = this.pick(pk[1]!, 'latest');
      return p
        ? ok({
            n: p.n,
            s: '',
            dt: { latest: p.v },
            latest: await this.signed(p),
            i: 0,
            vf: 1,
            st: 'active',
            dep: null,
            scan: 'passed',
            contextPreview: null,
            distTags: { latest: p.v },
          })
        : new Response('{}', { status: 404 });
    }
    const m = url.pathname.match(/^\/v1\/resolve\/(@[^/]+\/[^/]+)$/);
    if (!m)
      return new Response(JSON.stringify({ code: 'E_NOT_FOUND', params: { name: url.pathname } }), { status: 404 });
    const root = this.pick(m[1]!, url.searchParams.get('range') ?? 'latest');
    if (!root) return new Response(JSON.stringify({ code: 'E_NOT_FOUND', params: { name: m[1] } }), { status: 404 });
    const installed = new Map(
      (url.searchParams.get('installed') ?? '')
        .split(',')
        .filter(Boolean)
        .map((s) => [s.slice(0, s.lastIndexOf('@')), s.slice(s.lastIndexOf('@') + 1)]),
    );
    const deps: ResolvedManifest[] = [];
    const queue = [root];
    const seen = new Set([root.n]);
    while (queue.length) {
      const cur = queue.shift()!;
      for (const [dn, range] of Object.entries(cur.g ?? {})) {
        if (seen.has(dn)) continue;
        seen.add(dn);
        const inst = installed.get(dn);
        const d = inst && satisfies(inst, range) ? this.pick(dn, inst) : this.pick(dn, range);
        if (!d)
          return new Response(JSON.stringify({ code: 'E_RANGE_UNSATISFIED', params: { detail: dn } }), { status: 409 });
        deps.push(d);
        queue.push(d);
      }
    }
    const body = {
      root: await this.signed(root),
      deps: await Promise.all(deps.map((d) => this.signed(d))),
      w: [],
      scan: Object.fromEntries([root, ...deps].map((p) => [p.n, this.scan[p.n] ?? 'passed'])),
    };
    return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
  };
}
