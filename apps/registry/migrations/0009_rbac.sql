-- Registros privados con RBAC (V10-01, api-spec §5.4): puramente aditiva, ninguna tabla existente cambia.
-- Acceso a un registro privado: registry_members (cuenta o org completa) ∪ miembros de la org dueña.
-- Lectura de paquetes: `internal` = cualquier miembro; `private` = admins del registro o grant explícito.
CREATE TABLE teams (
  id         TEXT PRIMARY KEY,                                -- team_<ulid>
  org_id     TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  slug       TEXT NOT NULL COLLATE NOCASE,
  name       TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (org_id, slug)
);
CREATE TABLE team_members (
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  role    TEXT NOT NULL CHECK (role IN ('maintainer','member')),
  PRIMARY KEY (team_id, user_id)
);
CREATE INDEX idx_team_members_user ON team_members(user_id);
CREATE TABLE package_grants (
  package_id     TEXT NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  principal_type TEXT NOT NULL CHECK (principal_type IN ('user','team')),
  principal_id   TEXT NOT NULL,
  permission     TEXT NOT NULL CHECK (permission IN ('read','write','admin')),
  created_at     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (package_id, principal_type, principal_id)
);
CREATE INDEX idx_grants_principal ON package_grants(principal_id);
CREATE TABLE registry_members (
  registry_id TEXT NOT NULL REFERENCES registries(id) ON DELETE CASCADE,
  account_id  TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,  -- user u org completa
  role        TEXT NOT NULL CHECK (role IN ('admin','publisher','reader')),
  created_at  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (registry_id, account_id)
);
CREATE INDEX idx_registry_members_account ON registry_members(account_id);
