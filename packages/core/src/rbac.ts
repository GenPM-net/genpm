// Gestión de registros privados, equipos y accesos por paquete (V10-01, api-spec §5.4). Validación aquí; el CLI solo
// formatea. Todo pasa por el registry: permisos y auditoría los aplica el servidor.

import { NAME_RE } from '@genpm/manifest';
import { fail } from './errors.js';
import { type CommonOptions, clientFor } from './ops.js';

const SLUG = /^[a-z0-9][a-z0-9-]{1,38}$/;
const HANDLE = /^@?[A-Za-z0-9-]{1,39}$/;
const PRINCIPAL = /^(user:@?[A-Za-z0-9-]{1,39}|team:@?[A-Za-z0-9-]{1,39}\/[a-z0-9][a-z0-9-]{1,38})$/;

export type RegistryRole = 'admin' | 'publisher' | 'reader';
export type RegistryInfo = {
  slug: string;
  plan: string;
  role: RegistryRole;
  url: string;
  customDomain: string | null;
  owner?: string | null;
  members?: Array<{ handle: string; kind: string; role: string }>;
};

const usage = (detail: string) => fail('E_USAGE', { detail });
const handle = (h: string) => {
  if (!HANDLE.test(h)) throw usage(`invalid handle: ${h}`);
  return h.replace(/^@/, '');
};
const slug = (s: string) => {
  if (!SLUG.test(s)) throw usage(`invalid name: ${s}`);
  return s;
};

async function client(opts: CommonOptions, name: string | null = null) {
  const { client } = await clientFor(opts, name);
  return client;
}

// ───────────── Registros ─────────────

export async function registryList(opts: CommonOptions) {
  return (await (await client(opts)).api<{ registries: RegistryInfo[] }>('GET', '/v1/registries')).registries;
}

export async function registryCreate(opts: CommonOptions & { slug: string; owner: string }) {
  return (await client(opts)).api<RegistryInfo>('POST', '/v1/registries', {
    slug: slug(opts.slug),
    owner: handle(opts.owner),
  });
}

export async function registryShow(opts: CommonOptions & { slug: string }) {
  return (await client(opts)).api<RegistryInfo>('GET', `/v1/registries/${slug(opts.slug)}`);
}

export async function registryMember(
  opts: CommonOptions & { slug: string; handle: string; role: RegistryRole | null },
) {
  const path = `/v1/registries/${slug(opts.slug)}/members/${handle(opts.handle)}`;
  const c = await client(opts);
  return opts.role ? c.api('PUT', path, { role: opts.role }) : c.api('DELETE', path);
}

// ───────────── Equipos ─────────────

/** `acme/backend` → partes. */
function teamRef(ref: string): { org: string; team: string } {
  const m = ref.match(/^@?([A-Za-z0-9-]{1,39})\/([a-z0-9][a-z0-9-]{1,38})$/);
  if (!m) throw usage(`expected <org>/<team>: ${ref}`);
  return { org: m[1]!, team: m[2]! };
}

export async function teamList(opts: CommonOptions & { org: string }) {
  return (await client(opts)).api<{
    org: string;
    teams: Array<{ slug: string; name: string; members: Array<{ handle: string; role: string }> }>;
  }>('GET', `/v1/orgs/${handle(opts.org)}/teams`);
}

export async function teamCreate(opts: CommonOptions & { ref: string; name?: string }) {
  const { org, team } = teamRef(opts.ref);
  return (await client(opts)).api('POST', `/v1/orgs/${org}/teams`, {
    slug: team,
    ...(opts.name ? { name: opts.name } : {}),
  });
}

export async function teamDelete(opts: CommonOptions & { ref: string }) {
  const { org, team } = teamRef(opts.ref);
  return (await client(opts)).api('DELETE', `/v1/orgs/${org}/teams/${team}`);
}

export async function teamMember(
  opts: CommonOptions & { ref: string; handle: string; role: 'maintainer' | 'member' | null },
) {
  const { org, team } = teamRef(opts.ref);
  const path = `/v1/orgs/${org}/teams/${team}/members/${handle(opts.handle)}`;
  const c = await client(opts);
  return opts.role ? c.api('PUT', path, { role: opts.role }) : c.api('DELETE', path);
}

// ───────────── Accesos por paquete ─────────────

const pkg = (name: string) => {
  if (!NAME_RE.test(name)) throw usage(`expected @scope/name: ${name}`);
  return name;
};
const principal = (p: string) => {
  if (!PRINCIPAL.test(p)) throw usage(`expected user:<handle> or team:<org>/<team>: ${p}`);
  return p;
};

export async function accessList(opts: CommonOptions & { name: string }) {
  return (await client(opts, opts.name)).api<{
    name: string;
    visibility: string;
    grants: Array<{ principal: string; permission: string }>;
  }>('GET', `/v1/packages/${pkg(opts.name)}/access`);
}

export async function accessVisibility(opts: CommonOptions & { name: string; visibility: string }) {
  if (opts.visibility !== 'internal' && opts.visibility !== 'private') throw usage('visibility: internal | private');
  return (await client(opts, opts.name)).api('PUT', `/v1/packages/${pkg(opts.name)}/access`, {
    visibility: opts.visibility,
  });
}

export async function accessGrant(
  opts: CommonOptions & { name: string; principal: string; permission: 'read' | 'write' | 'admin' | null },
) {
  const c = await client(opts, opts.name);
  const base = `/v1/packages/${pkg(opts.name)}/grants`;
  if (!opts.permission) return c.api('DELETE', `${base}?principal=${encodeURIComponent(principal(opts.principal))}`);
  if (!['read', 'write', 'admin'].includes(opts.permission)) throw usage('permission: read | write | admin');
  return c.api('PUT', base, { principal: principal(opts.principal), permission: opts.permission });
}
