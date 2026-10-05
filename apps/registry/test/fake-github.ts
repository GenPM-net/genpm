// GitHub falso para tests de contrato (api-spec §10): API, raw y codeload (tar.gz) en memoria.

export type FakeFile = string | { content: string; mode?: number; symlink?: string };
export type FakeRepo = {
  id: number;
  private?: boolean;
  archived?: boolean;
  description?: string;
  license?: string;
  tags: Record<string, string>;
  branches?: Record<string, string>;
  commits: Record<string, Record<string, FakeFile>>;
};

export type FakeUser = {
  id: number;
  login: string;
  avatar_url?: string;
  email?: string;
  orgs?: Array<{ login: string; id: number; role?: 'admin' | 'member' }>;
};

const enc = new TextEncoder();

function header(name: string, size: number, mode: number, type: string, linkname = ''): Uint8Array {
  const h = new Uint8Array(512);
  const put = (s: string, off: number, len: number) => h.set(enc.encode(s).subarray(0, len), off);
  let prefix = '';
  let n = name;
  if (enc.encode(name).length > 100) {
    const cut = name.lastIndexOf('/', 154);
    prefix = name.slice(0, cut);
    n = name.slice(cut + 1);
  }
  put(n, 0, 100);
  put(`${mode.toString(8).padStart(7, '0')}\0`, 100, 8);
  put('0000000\0', 108, 8);
  put('0000000\0', 116, 8);
  put(`${size.toString(8).padStart(11, '0')}\0`, 124, 12);
  put(
    `${Math.floor(Date.now() / 1000)
      .toString(8)
      .padStart(11, '0')}\0`,
    136,
    12,
  );
  put('        ', 148, 8);
  put(type, 156, 1);
  put(linkname, 157, 100);
  put('ustar\0', 257, 6);
  put('00', 263, 2);
  put(prefix, 345, 155);
  let sum = 0;
  for (const b of h) sum += b;
  put(`${sum.toString(8).padStart(6, '0')}\0 `, 148, 8);
  return h;
}

export async function tarGz(root: string, files: Record<string, FakeFile>): Promise<Uint8Array> {
  const parts: Uint8Array[] = [header(`${root}/`, 0, 0o755, '5')];
  for (const [path, f] of Object.entries(files)) {
    const file = typeof f === 'string' ? { content: f } : f;
    if (file.symlink) {
      parts.push(header(`${root}/${path}`, 0, 0o777, '2', file.symlink));
      continue;
    }
    const data = enc.encode(file.content);
    parts.push(header(`${root}/${path}`, data.length, file.mode ?? 0o644, '0'));
    const padded = new Uint8Array(Math.ceil(data.length / 512) * 512);
    padded.set(data);
    parts.push(padded);
  }
  parts.push(new Uint8Array(1024));
  const total = parts.reduce((n, p) => n + p.length, 0);
  const tar = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    tar.set(p, o);
    o += p.length;
  }
  const gz = new Response(new Blob([tar]).stream().pipeThrough(new CompressionStream('gzip')));
  return new Uint8Array(await gz.arrayBuffer());
}

export class FakeGitHub {
  repos = new Map<string, FakeRepo>();
  users = new Map<string, FakeUser>();
  calls: string[] = [];

  addRepo(fullName: string, repo: FakeRepo): this {
    this.repos.set(fullName.toLowerCase(), repo);
    return this;
  }

  addUser(token: string, user: FakeUser): this {
    this.users.set(token, user);
    return this;
  }

  private resolve(repo: FakeRepo, ref: string): string | null {
    if (repo.commits[ref]) return ref;
    return repo.tags[ref] ?? repo.branches?.[ref] ?? null;
  }

  /** Respuesta de /repos/:o/:r/compare por repo (`owner/repo`). */
  compareFiles: Record<string, unknown[]> = {};

  async fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const req = new Request(input, init);
    const url = new URL(req.url);
    this.calls.push(`${req.method} ${url.host}${url.pathname}`);
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    const notFound = () => json({ message: 'Not Found' }, 404);
    const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    if (url.host === 'api.github.com') {
      if (parts[0] === 'repos' && parts[3] === 'compare')
        return json({ files: this.compareFiles[`${parts[1]}/${parts[2]}`] ?? [] });
      const token = req.headers.get('authorization')?.replace(/^(Bearer|token)\s+/i, '') ?? '';
      if (parts[0] === 'user') {
        const user = this.users.get(token);
        if (!user) return json({ message: 'Bad credentials' }, 401);
        if (parts[1] === 'orgs') return json((user.orgs ?? []).map((o) => ({ login: o.login, id: o.id })));
        if (parts[1] === 'memberships')
          return json(
            (user.orgs ?? []).map((o) => ({
              role: o.role ?? 'member',
              state: 'active',
              organization: { login: o.login, id: o.id },
            })),
          );
        return json({ id: user.id, login: user.login, avatar_url: user.avatar_url ?? null, email: user.email ?? null });
      }
      // Listados de repos de un usuario u org (asistente de publicación web).
      if ((parts[0] === 'users' || parts[0] === 'orgs') && parts[2] === 'repos') {
        const owner = parts[1]!.toLowerCase();
        return json(
          [...this.repos.entries()]
            .filter(([k]) => k.startsWith(`${owner}/`))
            .map(([k, r]) => ({
              name: k.split('/')[1],
              full_name: k,
              owner: { login: parts[1] },
              description: r.description ?? null,
              private: !!r.private,
              fork: false,
              archived: !!r.archived,
              default_branch: 'main',
              pushed_at: '2026-10-01T00:00:00Z',
              html_url: `https://github.com/${k}`,
            })),
        );
      }
      if (parts[0] !== 'repos') return notFound();
      const repo = this.repos.get(`${parts[1]}/${parts[2]}`.toLowerCase());
      if (!repo) return notFound();
      const rest = parts.slice(3);
      if (rest.length === 0)
        return json({
          id: repo.id,
          name: parts[2],
          full_name: `${parts[1]}/${parts[2]}`,
          private: !!repo.private,
          owner: { login: parts[1] },
          default_branch: 'main',
          description: repo.description ?? null,
        });
      if (rest[0] === 'tags') return json(Object.keys(repo.tags).map((name) => ({ name })));
      if (rest[0] === 'git' && rest[1] === 'ref' && rest[2] === 'tags') {
        const ref = rest.slice(3).join('/');
        return repo.tags[ref]
          ? json({ ref: `refs/tags/${ref}`, object: { sha: repo.tags[ref], type: 'commit' } })
          : notFound();
      }
      if (rest[0] === 'branches') return repo.branches?.[rest[1]!] ? json({ name: rest[1] }) : notFound();
      if (rest[0] === 'commits') {
        const sha = this.resolve(repo, rest.slice(1).join('/'));
        return sha ? json({ sha }) : notFound();
      }
      if (rest[0] === 'license') return repo.license ? json({ license: { spdx_id: repo.license } }) : notFound();
      return notFound();
    }
    if (url.host === 'raw.githubusercontent.com') {
      const repo = this.repos.get(`${parts[0]}/${parts[1]}`.toLowerCase());
      const files = repo?.commits[parts[2]!];
      const f = files?.[parts.slice(3).join('/')];
      if (f === undefined) return new Response('404: Not Found', { status: 404 });
      return new Response(typeof f === 'string' ? f : f.content);
    }
    if (url.host === 'codeload.github.com') {
      const repo = this.repos.get(`${parts[0]}/${parts[1]}`.toLowerCase());
      const sha = parts[3]!;
      const files = repo?.commits[sha];
      if (!files) return new Response('404', { status: 404 });
      return new Response((await tarGz(`${parts[1]}-${sha}`, files)) as BodyInit, {
        headers: { 'content-type': 'application/x-gzip' },
      });
    }
    return new Response('blocked', { status: 599 });
  }
}
