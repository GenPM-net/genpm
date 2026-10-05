-- Puntuación de calidad (V02-04): 0–100 y el detalle de comprobaciones que la componen. Aditiva: columnas con default.
-- La recalcula el cron diario (incluye "mantenido" y "verificado", que cambian con el tiempo) y cada publish.
ALTER TABLE packages ADD COLUMN quality_score INTEGER NOT NULL DEFAULT 0 CHECK (quality_score BETWEEN 0 AND 100);
ALTER TABLE packages ADD COLUMN quality TEXT CHECK (quality IS NULL OR json_valid(quality));
