-- Metadatos operativos del registry (clave → valor JSON): lista de revocación de claves firmada por la clave raíz,
-- modo solo lectura (security §9) y versión del escáner. Aditiva: no toca tablas existentes.
CREATE TABLE registry_meta (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL CHECK (json_valid(value)),
  updated_at  INTEGER NOT NULL
);

-- Firma Ed25519 (`sg`) calculada una sola vez al publicar: resolve la sirve sin volver a firmar (INV-8).
ALTER TABLE package_versions ADD COLUMN signature TEXT;
