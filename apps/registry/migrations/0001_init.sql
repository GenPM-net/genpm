PRAGMA foreign_keys = ON;

-- ───────────── Identidad ─────────────
CREATE TABLE accounts (
  id             TEXT PRIMARY KEY,                         -- acc_<ulid>
  kind           TEXT NOT NULL CHECK (kind IN ('user','org')),
  handle         TEXT NOT NULL COLLATE NOCASE UNIQUE,      -- 'yohangel', 'genpm'
  display_name   TEXT,
  avatar_url     TEXT,
  email          TEXT,                                     -- solo users; nunca se expone públicamente
  github_id      INTEGER UNIQUE,                           -- id numérico estable de GitHub
  github_login   TEXT,
  locale         TEXT,                                     -- BCP 47 preferido (emails, web logueada); NULL = negociar
  has_2fa        INTEGER NOT NULL DEFAULT 0 CHECK (has_2fa IN (0,1)), -- comprobado vía GitHub (requisito de verificación)
  is_verified    INTEGER NOT NULL DEFAULT 0 CHECK (is_verified IN (0,1)),
  is_staff       INTEGER NOT NULL DEFAULT 0 CHECK (is_staff IN (0,1)),
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','deleted')),
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);

CREATE TABLE memberships (
  org_id     TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('owner','admin','publisher','member','reader')),
  source     TEXT NOT NULL DEFAULT 'github' CHECK (source IN ('github','manual','sso','scim')),
  synced_at  INTEGER,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (org_id, user_id)
);
CREATE INDEX idx_memberships_user ON memberships(user_id);

-- ───────────── Tenancy ─────────────
CREATE TABLE registries (
  id               TEXT PRIMARY KEY,                       -- 'reg_public' para el registro público
  slug             TEXT NOT NULL UNIQUE,                   -- 'public', 'acme'
  owner_id         TEXT REFERENCES accounts(id),           -- NULL para el público
  plan             TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','team','enterprise')),
  is_public        INTEGER NOT NULL DEFAULT 1 CHECK (is_public IN (0,1)),
  isolation        TEXT NOT NULL DEFAULT 'shared' CHECK (isolation IN ('shared','dedicated')),
  custom_domain    TEXT UNIQUE,
  settings         TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(settings)),
  created_at       INTEGER NOT NULL
);

CREATE TABLE scopes (
  id           TEXT PRIMARY KEY,                           -- scp_<ulid>
  registry_id  TEXT NOT NULL REFERENCES registries(id),
  name         TEXT NOT NULL COLLATE NOCASE,               -- 'core' (sin '@')
  owner_id     TEXT NOT NULL REFERENCES accounts(id),
  git_host     TEXT NOT NULL DEFAULT 'github.com',
  git_owner    TEXT NOT NULL COLLATE NOCASE,               -- owner de repos permitido (ADR-006)
  is_reserved  INTEGER NOT NULL DEFAULT 0 CHECK (is_reserved IN (0,1)),
  created_at   INTEGER NOT NULL,
  UNIQUE (registry_id, name)
);

-- ───────────── Paquetes ─────────────
CREATE TABLE packages (
  id                 TEXT PRIMARY KEY,                     -- pkg_<ulid>
  registry_id        TEXT NOT NULL REFERENCES registries(id),
  scope_id           TEXT NOT NULL REFERENCES scopes(id),
  name               TEXT NOT NULL COLLATE NOCASE,         -- 'auth'
  full_name          TEXT NOT NULL COLLATE NOCASE,         -- '@core/auth'
  owner_id           TEXT NOT NULL REFERENCES accounts(id),-- user u org (RBAC futuro se apoya aquí)
  created_by         TEXT NOT NULL REFERENCES accounts(id),
  visibility         TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','internal','private')),
  summary            TEXT,
  repo_url           TEXT NOT NULL,
  git_repo_id        INTEGER,                              -- id numérico de GitHub: detecta repojacking (security §3.3)
  homepage           TEXT,
  license            TEXT,
  category           TEXT,                                 -- lista curada: auth, db, billing, email, ai, ui, infra…
  latest_version_id  TEXT,                                 -- FK lógica a package_versions (evita ciclo en DDL)
  latest_version     TEXT,
  has_mcp            INTEGER NOT NULL DEFAULT 0 CHECK (has_mcp IN (0,1)),
  -- Monetización
  is_featured        INTEGER NOT NULL DEFAULT 0 CHECK (is_featured IN (0,1)),
  featured_rank      INTEGER,                              -- orden en la home (menor = antes)
  is_sponsored       INTEGER NOT NULL DEFAULT 0 CHECK (is_sponsored IN (0,1)), -- derivado de sponsorships activos (cron)
  -- Ciclo de vida
  status             TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','quarantined','removed')),
  is_deprecated      INTEGER NOT NULL DEFAULT 0 CHECK (is_deprecated IN (0,1)),
  deprecation_msg    TEXT,
  -- Métricas desnormalizadas (cron)
  installs_total     INTEGER NOT NULL DEFAULT 0,
  installs_30d       INTEGER NOT NULL DEFAULT 0,
  popularity_score   REAL    NOT NULL DEFAULT 0,           -- precalculado: ln(1+installs_30d)/10 + verificado + recencia
  created_at         INTEGER NOT NULL,
  updated_at         INTEGER NOT NULL,
  UNIQUE (registry_id, full_name),
  UNIQUE (scope_id, name)
);
CREATE INDEX idx_packages_registry_vis ON packages(registry_id, visibility, status);
CREATE INDEX idx_packages_owner ON packages(owner_id);
CREATE INDEX idx_packages_featured ON packages(registry_id, is_featured, featured_rank) WHERE is_featured = 1;
CREATE INDEX idx_packages_popular ON packages(registry_id, installs_30d DESC);

CREATE TABLE package_versions (
  id               TEXT PRIMARY KEY,                       -- ver_<ulid>
  package_id       TEXT NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  version          TEXT NOT NULL,
  v_major          INTEGER NOT NULL,
  v_minor          INTEGER NOT NULL,
  v_patch          INTEGER NOT NULL,
  v_prerelease     TEXT,                                   -- NULL = estable (ordena después de prereleases)
  git_ref          TEXT NOT NULL,                          -- t
  commit_sha       TEXT NOT NULL CHECK (length(commit_sha) IN (40,64)), -- c
  dest             TEXT NOT NULL,                          -- d
  include_path     TEXT NOT NULL DEFAULT '.',              -- i
  context_path     TEXT NOT NULL DEFAULT 'AGENTS.md',      -- x
  context_excerpt  TEXT,                                   -- primeros 2 KB de x (preview web)
  manifest         TEXT NOT NULL CHECK (json_valid(manifest)), -- resuelto canónico (§8 manifest-spec)
  manifest_hash    TEXT NOT NULL,
  has_mcp          INTEGER NOT NULL DEFAULT 0 CHECK (has_mcp IN (0,1)),
  scan_status      TEXT NOT NULL DEFAULT 'pending' CHECK (scan_status IN ('pending','passed','flagged','failed')),
  scan_report      TEXT CHECK (scan_report IS NULL OR json_valid(scan_report)),
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','quarantined')),
  published_by     TEXT NOT NULL REFERENCES accounts(id),
  published_at     INTEGER NOT NULL,
  yanked_at        INTEGER,
  yank_reason      TEXT,
  UNIQUE (package_id, version)
);
CREATE INDEX idx_versions_semver ON package_versions(package_id, v_major DESC, v_minor DESC, v_patch DESC);
CREATE INDEX idx_versions_commit ON package_versions(commit_sha);

CREATE TABLE dist_tags (
  package_id  TEXT NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  tag         TEXT NOT NULL CHECK (tag GLOB '[a-z]*'),     -- 'latest', 'next', 'beta'
  version_id  TEXT NOT NULL REFERENCES package_versions(id),
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (package_id, tag)
);

CREATE TABLE package_keywords (
  package_id  TEXT NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  keyword     TEXT NOT NULL,
  PRIMARY KEY (package_id, keyword)
);
CREATE INDEX idx_keywords_kw ON package_keywords(keyword);

CREATE TABLE package_dependencies (
  version_id   TEXT NOT NULL REFERENCES package_versions(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('genpm','npm')),
  dep_name     TEXT NOT NULL,
  dep_range    TEXT NOT NULL,
  PRIMARY KEY (version_id, kind, dep_name)
);
CREATE INDEX idx_deps_reverse ON package_dependencies(kind, dep_name);   -- "usado por"

-- ───────────── Búsqueda ─────────────
CREATE VIRTUAL TABLE packages_fts USING fts5(
  package_id UNINDEXED,
  full_name,
  summary,
  keywords,
  tokenize = 'unicode61 remove_diacritics 2',
  prefix = '2 3'
);
-- `summary` concatena todos los idiomas de `s`.
-- Mantenida por la aplicación dentro del batch de publish (DELETE + INSERT por package_id).

CREATE VIRTUAL TABLE packages_fts_cjk USING fts5(        -- consultas con chino/japonés/coreano (i18n §4.6)
  package_id UNINDEXED,
  full_name,
  summary,
  tokenize = 'trigram'
);
-- Derivada: si se corrompe o en export, se reconstruye desde packages + package_keywords.

-- ───────────── Monetización ─────────────
CREATE TABLE sponsorships (
  id                  TEXT PRIMARY KEY,                    -- spn_<ulid>
  registry_id         TEXT NOT NULL REFERENCES registries(id),
  package_id          TEXT NOT NULL REFERENCES packages(id),
  sponsor_account_id  TEXT NOT NULL REFERENCES accounts(id),
  placement           TEXT NOT NULL CHECK (placement IN ('home_featured','search_slot','category_slot','newsletter')),
  target              TEXT,                                -- keyword o categoría para search/category
  starts_at           INTEGER NOT NULL,
  ends_at             INTEGER NOT NULL,
  status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','ended','cancelled')),
  amount_cents        INTEGER,
  currency            TEXT DEFAULT 'USD',
  external_ref        TEXT,                                -- id de Stripe
  impressions         INTEGER NOT NULL DEFAULT 0,
  clicks              INTEGER NOT NULL DEFAULT 0,
  created_at          INTEGER NOT NULL,
  CHECK (ends_at > starts_at)
);
CREATE INDEX idx_sponsorships_active ON sponsorships(registry_id, placement, status, starts_at, ends_at);

-- ───────────── Auth ─────────────
CREATE TABLE api_tokens (
  id            TEXT PRIMARY KEY,                          -- tok_<ulid>
  account_id    TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  registry_id   TEXT REFERENCES registries(id),            -- NULL = válido en todos donde la cuenta tenga acceso
  org_id        TEXT REFERENCES accounts(id),              -- NULL = personal; si no, restringido a esa org (SaaS)
  name          TEXT NOT NULL,
  token_prefix  TEXT NOT NULL,
  token_hash    TEXT NOT NULL UNIQUE,
  scopes        TEXT NOT NULL DEFAULT '["read"]' CHECK (json_valid(scopes)),  -- read | publish | admin
  allowed_packages TEXT CHECK (allowed_packages IS NULL OR json_valid(allowed_packages)), -- tokens granulares (CI)
  expires_at    INTEGER,
  last_used_at  INTEGER,
  revoked_at    INTEGER,
  created_at    INTEGER NOT NULL
);
CREATE INDEX idx_tokens_account ON api_tokens(account_id);

CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,                            -- hash del id de cookie
  account_id  TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL,
  ip_hash     TEXT,
  user_agent  TEXT,
  created_at  INTEGER NOT NULL
);

-- ───────────── Operación ─────────────
CREATE TABLE install_stats_daily (
  package_id  TEXT NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  day         TEXT NOT NULL,                               -- 'YYYY-MM-DD' UTC
  installs    INTEGER NOT NULL DEFAULT 0,
  via_mcp     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (package_id, day)
);

CREATE TABLE reports (
  id            TEXT PRIMARY KEY,
  package_id    TEXT NOT NULL REFERENCES packages(id),
  version_id    TEXT REFERENCES package_versions(id),
  reporter_id   TEXT REFERENCES accounts(id),
  reason        TEXT NOT NULL CHECK (reason IN ('malware','prompt_injection','spam','typosquat','license','other')),
  details       TEXT,
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','triaged','actioned','dismissed')),
  created_at    INTEGER NOT NULL
);

CREATE TABLE advisories (
  id              TEXT PRIMARY KEY,                        -- adv_<ulid> / GENPM-2026-0001 como alias público
  public_id       TEXT NOT NULL UNIQUE,
  package_id      TEXT NOT NULL REFERENCES packages(id),
  affected_range  TEXT NOT NULL,                           -- rango semver
  patched_version TEXT,
  severity        TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  cve             TEXT,
  title           TEXT NOT NULL CHECK (json_valid(title)),   -- {"en":"…","es":"…"}
  description     TEXT NOT NULL CHECK (json_valid(description)),
  published_at    INTEGER NOT NULL,
  withdrawn_at    INTEGER
);
CREATE INDEX idx_advisories_package ON advisories(package_id);

CREATE TABLE signing_keys (
  id          TEXT PRIMARY KEY,                            -- keyid ('k1', 'k2'…)
  public_key  TEXT NOT NULL,                               -- Ed25519, base64url
  status      TEXT NOT NULL CHECK (status IN ('active','next','retired','revoked')),
  created_at  INTEGER NOT NULL,
  revoked_at  INTEGER
);

CREATE TABLE leads (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL CHECK (kind IN ('sponsor','enterprise')),
  email       TEXT NOT NULL,
  company     TEXT,
  details     TEXT CHECK (details IS NULL OR json_valid(details)),
  status      TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','won','lost')),
  created_at  INTEGER NOT NULL
);

CREATE TABLE audit_log (
  id           TEXT PRIMARY KEY,                           -- aud_<ulid> (ordenable por tiempo)
  registry_id  TEXT NOT NULL,
  actor_id     TEXT,                                       -- NULL = sistema/cron
  action       TEXT NOT NULL,                              -- 'package.publish', 'version.yank', 'token.create'…
  target_type  TEXT NOT NULL,
  target_id    TEXT NOT NULL,
  ip_hash      TEXT,
  metadata     TEXT CHECK (metadata IS NULL OR json_valid(metadata)),
  created_at   INTEGER NOT NULL
);
CREATE INDEX idx_audit_target ON audit_log(target_type, target_id);
CREATE INDEX idx_audit_registry_time ON audit_log(registry_id, created_at);

-- Seed obligatorio
INSERT INTO registries (id, slug, owner_id, plan, is_public, isolation, created_at)
VALUES ('reg_public', 'public', NULL, 'free', 1, 'shared', unixepoch() * 1000);

-- Cuenta de sistema dueña de los scopes oficiales y reservados (sin github_id: nadie puede iniciar sesión como ella)
INSERT INTO accounts (id, kind, handle, display_name, is_verified, is_staff, status, created_at, updated_at)
VALUES ('acc_system', 'org', 'genpm-system', 'GenPM', 1, 1, 'active', unixepoch() * 1000, unixepoch() * 1000);

-- Scopes reservados (security §3.2). `core` publica desde la org genpm-net; el resto queda bloqueado.
-- Sin estas filas, ADR-006 permitiría al dueño de la cuenta `genpm` de GitHub reclamar `@genpm`.
INSERT INTO scopes (id, registry_id, name, owner_id, git_host, git_owner, is_reserved, created_at) VALUES
  ('scp_core',     'reg_public', 'core',     'acc_system', 'github.com', 'genpm-net', 1, unixepoch() * 1000),
  ('scp_genpm',    'reg_public', 'genpm',    'acc_system', 'github.com', 'genpm-net', 1, unixepoch() * 1000),
  ('scp_genpm_net','reg_public', 'genpm-net', 'acc_system', 'github.com', 'genpm-net', 1, unixepoch() * 1000),
  ('scp_official', 'reg_public', 'official', 'acc_system', 'github.com', 'genpm-net', 1, unixepoch() * 1000),
  ('scp_admin',    'reg_public', 'admin',    'acc_system', 'github.com', 'genpm-net', 1, unixepoch() * 1000),
  ('scp_security', 'reg_public', 'security', 'acc_system', 'github.com', 'genpm-net', 1, unixepoch() * 1000),
  ('scp_registry', 'reg_public', 'registry', 'acc_system', 'github.com', 'genpm-net', 1, unixepoch() * 1000),
  ('scp_npm',      'reg_public', 'npm',      'acc_system', 'github.com', 'genpm-net', 1, unixepoch() * 1000),
  ('scp_github',   'reg_public', 'github',   'acc_system', 'github.com', 'genpm-net', 1, unixepoch() * 1000);
-- Las marcas (top 500 empresas tech) van en migraciones de datos posteriores (0002_reserved_brands.sql).
-- Regla de publish: is_reserved = 1 ⇒ solo cuentas con rol en acc_system (staff) pueden publicar o transferir el scope.
