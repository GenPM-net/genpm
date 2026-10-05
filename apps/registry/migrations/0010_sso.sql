-- SSO por organización (V10-02, ADR-030): OIDC (Okta, Entra ID, Google Workspace…). Aditiva.
-- `config`: { issuer, authorizationEndpoint, tokenEndpoint, jwksUri, clientId, clientSecretEnc, domains[], enforce }.
-- El secreto del cliente va cifrado (AES-GCM, clave derivada de TOKEN_PEPPER con HKDF).
CREATE TABLE sso_connections (
  id         TEXT PRIMARY KEY,                                -- sso_<ulid>
  org_id     TEXT NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  protocol   TEXT NOT NULL CHECK (protocol IN ('saml','oidc')),
  config     TEXT NOT NULL CHECK (json_valid(config)),
  created_at INTEGER NOT NULL
);
-- Identidad del IdP vinculada a una cuenta de GenPM. `active = 0` (SCIM o el admin) corta el acceso derivado de la org.
CREATE TABLE sso_identities (
  connection_id TEXT NOT NULL REFERENCES sso_connections(id) ON DELETE CASCADE,
  subject       TEXT NOT NULL,
  account_id    TEXT REFERENCES accounts(id) ON DELETE CASCADE,
  email         TEXT,
  active        INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  last_auth_at  INTEGER,
  created_at    INTEGER NOT NULL,
  PRIMARY KEY (connection_id, subject),
  UNIQUE (connection_id, account_id)
);
CREATE INDEX idx_sso_identities_account ON sso_identities(account_id);
