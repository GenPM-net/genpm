-- SCIM 2.0 (ENT-02): el IdP da de alta y de baja a los miembros de la org. Aditiva.
-- `scim_id`: id del recurso SCIM (estable); `subject` = userName en minúsculas hasta que la persona entra por SSO y se
-- vincula con el `sub` del id_token (mismo email).
ALTER TABLE sso_identities ADD COLUMN scim_id TEXT;
CREATE UNIQUE INDEX idx_sso_identities_scim ON sso_identities(connection_id, scim_id);
