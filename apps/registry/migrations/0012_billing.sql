-- Facturación con Stripe (V10-05) y patrocinios self-serve (V10-06). Aditiva.
-- Idempotencia de webhooks: cada evento de Stripe se procesa una sola vez.
CREATE TABLE billing_events (
  id         TEXT PRIMARY KEY,                               -- evt_… de Stripe
  type       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
-- Estado de la suscripción de cada registro privado (el plan vive en registries.plan).
CREATE TABLE registry_billing (
  registry_id     TEXT PRIMARY KEY REFERENCES registries(id) ON DELETE CASCADE,
  customer_id     TEXT NOT NULL,                             -- cus_…
  subscription_id TEXT,                                      -- sub_…
  status          TEXT NOT NULL,                             -- active, trialing, past_due, canceled…
  seats           INTEGER NOT NULL DEFAULT 1,
  current_period_end INTEGER,
  updated_at      INTEGER NOT NULL
);
-- Patrocinio pagado y pendiente de revisión: `paid_at` lo fija el webhook; el staff lo activa (status = 'active').
ALTER TABLE sponsorships ADD COLUMN paid_at INTEGER;
