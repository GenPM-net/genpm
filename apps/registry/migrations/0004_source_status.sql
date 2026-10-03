-- Estado de la fuente Git de cada paquete (security §3.3): la auditoría diaria marca `unavailable` si el repo
-- desapareció o fue recreado por otro (repojacking). Aditiva: columna con default.
ALTER TABLE packages ADD COLUMN source_status TEXT NOT NULL DEFAULT 'ok' CHECK (source_status IN ('ok', 'unavailable'));
