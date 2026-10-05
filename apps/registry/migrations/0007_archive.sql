-- Verified Archive (V03-02, ADR-007): copia en R2 del tarball del commit de cada versión, por si el repo desaparece.
-- `archive_sig` firma {n, v, c, h} con la clave del registry: el CLI solo usa la copia si la firma y el sha256 cuadran.
ALTER TABLE package_versions ADD COLUMN archive_sha256 TEXT;
ALTER TABLE package_versions ADD COLUMN archive_size INTEGER;
ALTER TABLE package_versions ADD COLUMN archive_sig TEXT;
