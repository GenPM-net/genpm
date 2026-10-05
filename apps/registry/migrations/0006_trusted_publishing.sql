-- Trusted publishing (V03-01, security §4.2): publicar desde GitHub Actions con OIDC, sin tokens de larga vida.
-- Un dueño de scope autoriza un repositorio (y opcionalmente un workflow y un environment); el registry canjea el
-- token OIDC de GitHub por un token `publish` de 15 minutos restringido a ese scope y a ese repositorio. Aditiva.
CREATE TABLE trusted_publishers (
  id            TEXT PRIMARY KEY,                          -- tp_<ulid>
  registry_id   TEXT NOT NULL REFERENCES registries(id),
  scope_id      TEXT NOT NULL REFERENCES scopes(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL DEFAULT 'github' CHECK (provider IN ('github', 'gitlab')),
  repository    TEXT NOT NULL COLLATE NOCASE,              -- 'owner/repo' (GitHub) o 'group/project' (GitLab)
  repository_id TEXT,                                      -- id numérico del repo al autorizarlo (anti-repojacking)
  workflow      TEXT,                                      -- '.github/workflows/release.yml'; NULL = cualquiera
  environment   TEXT,                                      -- environment de Actions exigido; NULL = cualquiera
  created_by    TEXT NOT NULL REFERENCES accounts(id),
  created_at    INTEGER NOT NULL,
  UNIQUE (scope_id, provider, repository, workflow, environment)
);
CREATE INDEX idx_trusted_repo ON trusted_publishers(provider, repository);

-- Token emitido por OIDC: solo puede publicar desde este repositorio (además de `allowed_packages`).
ALTER TABLE api_tokens ADD COLUMN repository TEXT;
