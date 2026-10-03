// Capa de datos única del registry. Toda consulta de dominio exige un `Tenant` (INV-10): no existe forma de
// leer paquetes sin `registry_id`, y en el MVP solo se sirven paquetes `visibility = 'public'` (api-spec §5.4).
// Solo sentencias preparadas con bind(); nunca plantillas en prepare() (security §5, regla de Semgrep).

import type { Tenant } from '../env.js';

export type PackageRow = {
  id: string;
  registry_id: string;
  scope_id: string;
  name: string;
  full_name: string;
  owner_id: string;
  visibility: string;
  summary: string | null;
  repo_url: string;
  git_repo_id: number | null;
  homepage: string | null;
  license: string | null;
  category: string | null;
  latest_version_id: string | null;
  latest_version: string | null;
  has_mcp: number;
  is_featured: number;
  featured_rank: number | null;
  is_sponsored: number;
  status: 'active' | 'quarantined' | 'removed';
  is_deprecated: number;
  deprecation_msg: string | null;
  installs_total: number;
  installs_30d: number;
  popularity_score: number;
  created_at: number;
  updated_at: number;
};

export type VersionRow = {
  id: string;
  package_id: string;
  version: string;
  v_major: number;
  v_minor: number;
  v_patch: number;
  v_prerelease: string | null;
  git_ref: string;
  commit_sha: string;
  dest: string;
  include_path: string;
  context_path: string;
  context_excerpt: string | null;
  manifest: string;
  manifest_hash: string;
  has_mcp: number;
  scan_status: 'pending' | 'passed' | 'flagged' | 'failed';
  scan_report: string | null;
  status: 'active' | 'quarantined';
  published_by: string;
  published_at: number;
  yanked_at: number | null;
  yank_reason: string | null;
  signature: string | null;
};

export type PublisherRow = { handle: string; kind: 'user' | 'org'; is_verified: number; avatar_url: string | null };

const PUBLIC = "p.visibility = 'public' AND p.status != 'removed'";

export class Repo {
  constructor(
    readonly db: D1Database,
    readonly tenant: Tenant,
  ) {}

  private get rid() {
    return this.tenant.registryId;
  }

  // ───────────── Paquetes ─────────────

  async packageByName(fullName: string): Promise<PackageRow | null> {
    return this.db
      .prepare(`SELECT p.* FROM packages p WHERE p.registry_id = ?1 AND p.full_name = ?2 AND ${PUBLIC}`)
      .bind(this.rid, fullName)
      .first<PackageRow>();
  }

  async packagesByNames(names: readonly string[]): Promise<PackageRow[]> {
    if (names.length === 0) return [];
    const { results } = await this.db
      .prepare(
        `SELECT p.* FROM packages p WHERE p.registry_id = ?1 AND ${PUBLIC} AND p.full_name IN (SELECT value FROM json_each(?2))`,
      )
      .bind(this.rid, JSON.stringify(names))
      .all<PackageRow>();
    return results;
  }

  async publisherOf(pkg: Pick<PackageRow, 'owner_id'>): Promise<PublisherRow | null> {
    return this.db
      .prepare('SELECT handle, kind, is_verified, avatar_url FROM accounts WHERE id = ?1')
      .bind(pkg.owner_id)
      .first<PublisherRow>();
  }

  async keywordsOf(packageId: string): Promise<string[]> {
    const { results } = await this.db
      .prepare('SELECT keyword FROM package_keywords WHERE package_id = ?1 ORDER BY keyword')
      .bind(packageId)
      .all<{ keyword: string }>();
    return results.map((r) => r.keyword);
  }

  async distTags(packageId: string): Promise<Record<string, string>> {
    const { results } = await this.db
      .prepare(
        'SELECT d.tag, v.version FROM dist_tags d JOIN package_versions v ON v.id = d.version_id WHERE d.package_id = ?1',
      )
      .bind(packageId)
      .all<{ tag: string; version: string }>();
    return Object.fromEntries(results.map((r) => [r.tag, r.version]));
  }

  // ───────────── Versiones ─────────────

  async versions(packageId: string): Promise<VersionRow[]> {
    const { results } = await this.db
      .prepare(
        'SELECT * FROM package_versions WHERE package_id = ?1 ORDER BY v_major DESC, v_minor DESC, v_patch DESC, v_prerelease IS NOT NULL, v_prerelease DESC',
      )
      .bind(packageId)
      .all<VersionRow>();
    return results;
  }

  async version(packageId: string, version: string): Promise<VersionRow | null> {
    return this.db
      .prepare('SELECT * FROM package_versions WHERE package_id = ?1 AND version = ?2')
      .bind(packageId, version)
      .first<VersionRow>();
  }

  async versionById(id: string): Promise<VersionRow | null> {
    return this.db.prepare('SELECT * FROM package_versions WHERE id = ?1').bind(id).first<VersionRow>();
  }

  // ───────────── Búsqueda ─────────────

  async search(q: {
    match: string | null;
    cjk: boolean;
    keywords: string[];
    mcp: boolean;
    scope: string | null;
    sort: 'relevance' | 'installs' | 'recent';
    limit: number;
    offset: number;
  }): Promise<{ rows: Array<PackageRow & { is_verified: number; publisher: string; rel: number }>; total: number }> {
    const where = [`p.registry_id = ?1`, PUBLIC, "p.status = 'active'", 'p.latest_version IS NOT NULL'];
    const binds: unknown[] = [this.rid];
    let from = 'packages p';
    let rel = '0.0';
    if (q.match) {
      const table = q.cjk ? 'packages_fts_cjk' : 'packages_fts';
      from = `${table} f JOIN packages p ON p.id = f.package_id`;
      binds.push(q.match);
      where.push(`${table} MATCH ?${binds.length}`);
      rel = q.cjk ? `bm25(${table}, 0.0, 10.0, 2.0)` : `bm25(${table}, 0.0, 10.0, 2.0, 4.0)`;
    }
    if (q.keywords.length) {
      binds.push(JSON.stringify(q.keywords));
      where.push(
        `(SELECT count(*) FROM package_keywords k WHERE k.package_id = p.id AND k.keyword IN (SELECT value FROM json_each(?${binds.length}))) = ${q.keywords.length}`,
      );
    }
    if (q.mcp) where.push('p.has_mcp = 1');
    if (q.scope) {
      binds.push(`@${q.scope}/%`);
      where.push(`p.full_name LIKE ?${binds.length}`);
    }
    const order =
      q.sort === 'installs'
        ? 'p.installs_30d DESC, p.full_name'
        : q.sort === 'recent'
          ? 'p.updated_at DESC'
          : q.match
            ? 'rel * (1.0 + p.popularity_score) ASC, p.installs_30d DESC'
            : 'p.popularity_score DESC, p.installs_30d DESC, p.full_name';
    const whereSql = where.join(' AND ');
    binds.push(q.limit, q.offset);
    const sql = `SELECT p.*, a.is_verified AS is_verified, a.handle AS publisher, ${rel} AS rel
      FROM ${from} JOIN accounts a ON a.id = p.owner_id
      WHERE ${whereSql} ORDER BY ${order} LIMIT ?${binds.length - 1} OFFSET ?${binds.length}`;
    const countSql = `SELECT count(*) AS n FROM ${from} WHERE ${whereSql}`;
    const [rows, count] = await this.db.batch([
      this.db.prepare(sql).bind(...binds),
      this.db.prepare(countSql).bind(...binds.slice(0, -2)),
    ]);
    return {
      rows: (rows?.results ?? []) as Array<PackageRow & { is_verified: number; publisher: string; rel: number }>,
      total: ((count?.results?.[0] as { n: number } | undefined)?.n ?? 0) as number,
    };
  }

  async sponsoredSlot(
    keywords: readonly string[],
    now: number,
  ): Promise<{ full_name: string; latest_version: string; summary: string | null; campaign_id: string } | null> {
    return this.db
      .prepare(
        `SELECT p.full_name, p.latest_version, p.summary, s.id AS campaign_id
         FROM sponsorships s JOIN packages p ON p.id = s.package_id
         WHERE s.registry_id = ?1 AND s.placement = 'search_slot' AND s.status = 'active'
           AND ?2 BETWEEN s.starts_at AND s.ends_at
           AND (s.target IS NULL OR s.target IN (SELECT value FROM json_each(?3)))
           AND ${PUBLIC} AND p.status = 'active'
         ORDER BY random() LIMIT 1`,
      )
      .bind(this.rid, now, JSON.stringify(keywords))
      .first();
  }

  async featured(limit: number): Promise<Array<PackageRow & { is_verified: number; publisher: string }>> {
    const { results } = await this.db
      .prepare(
        `SELECT p.*, a.is_verified AS is_verified, a.handle AS publisher FROM packages p JOIN accounts a ON a.id = p.owner_id
         WHERE p.registry_id = ?1 AND ${PUBLIC} AND p.status = 'active' AND p.is_featured = 1 AND p.latest_version IS NOT NULL
         ORDER BY p.featured_rank IS NULL, p.featured_rank, p.full_name LIMIT ?2`,
      )
      .bind(this.rid, limit)
      .all<PackageRow & { is_verified: number; publisher: string }>();
    return results;
  }

  async trending(limit: number): Promise<Array<PackageRow & { is_verified: number; publisher: string }>> {
    const { results } = await this.db
      .prepare(
        `SELECT p.*, a.is_verified AS is_verified, a.handle AS publisher FROM packages p JOIN accounts a ON a.id = p.owner_id
         WHERE p.registry_id = ?1 AND ${PUBLIC} AND p.status = 'active' AND p.latest_version IS NOT NULL
         ORDER BY p.installs_30d DESC, p.popularity_score DESC, p.full_name LIMIT ?2`,
      )
      .bind(this.rid, limit)
      .all<PackageRow & { is_verified: number; publisher: string }>();
    return results;
  }

  async stats(): Promise<{
    packages: number;
    publishers: number;
    installs30d: number;
    installsTotal: number;
    withMcp: number;
  }> {
    const row = await this.db
      .prepare(
        `SELECT count(*) AS packages, count(DISTINCT p.owner_id) AS publishers, coalesce(sum(p.installs_30d), 0) AS installs30d,
                coalesce(sum(p.installs_total), 0) AS installsTotal, coalesce(sum(p.has_mcp), 0) AS withMcp
         FROM packages p WHERE p.registry_id = ?1 AND ${PUBLIC} AND p.status = 'active' AND p.latest_version IS NOT NULL`,
      )
      .bind(this.rid)
      .first<{ packages: number; publishers: number; installs30d: number; installsTotal: number; withMcp: number }>();
    return row ?? { packages: 0, publishers: 0, installs30d: 0, installsTotal: 0, withMcp: 0 };
  }

  async scope(
    name: string,
  ): Promise<{ id: string; name: string; owner_id: string; git_owner: string; is_reserved: number } | null> {
    return this.db
      .prepare('SELECT id, name, owner_id, git_owner, is_reserved FROM scopes WHERE registry_id = ?1 AND name = ?2')
      .bind(this.rid, name)
      .first();
  }

  async packagesOfScope(scopeId: string): Promise<Array<PackageRow & { is_verified: number; publisher: string }>> {
    const { results } = await this.db
      .prepare(
        `SELECT p.*, a.is_verified AS is_verified, a.handle AS publisher FROM packages p JOIN accounts a ON a.id = p.owner_id
         WHERE p.registry_id = ?1 AND p.scope_id = ?2 AND ${PUBLIC} AND p.latest_version IS NOT NULL ORDER BY p.installs_30d DESC, p.full_name`,
      )
      .bind(this.rid, scopeId)
      .all<PackageRow & { is_verified: number; publisher: string }>();
    return results;
  }

  async advisoriesFor(packageIds: readonly string[]): Promise<
    Array<{
      public_id: string;
      package_id: string;
      affected_range: string;
      patched_version: string | null;
      severity: string;
      cve: string | null;
      title: string;
      description: string;
      published_at: number;
    }>
  > {
    if (!packageIds.length) return [];
    const { results } = await this.db
      .prepare(
        `SELECT public_id, package_id, affected_range, patched_version, severity, cve, title, description, published_at FROM advisories
         WHERE withdrawn_at IS NULL AND package_id IN (SELECT value FROM json_each(?1)) ORDER BY published_at DESC`,
      )
      .bind(JSON.stringify(packageIds))
      .all();
    return results as never;
  }
}
