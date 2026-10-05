-- Recetas compose (V03-05): listas con nombre de paquetes que se instalan juntos (`genpm compose saas-starter`).
-- Las cura el staff por registry; `specs` es el JSON validado por `validateRecipe` de @genpm/manifest.
CREATE TABLE recipes (
  id          TEXT PRIMARY KEY,                             -- rcp_<ulid>
  registry_id TEXT NOT NULL REFERENCES registries(id),
  slug        TEXT NOT NULL,
  summary     TEXT,                                         -- JSON: string o { locale: texto }
  specs       TEXT NOT NULL,                                -- JSON: ["@core/db", "@core/auth@^1.2", …]
  created_by  TEXT NOT NULL REFERENCES accounts(id),
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  UNIQUE (registry_id, slug)
);
