-- Esquema D1 (documentación). El Worker lo auto-crea con ensureSchema(),
-- así que NO necesitas correr esto a mano (la consola D1 del panel suele fallar).

CREATE TABLE IF NOT EXISTS consentimientos (
  id               TEXT PRIMARY KEY,   -- uuid de la generación
  fecha            TEXT NOT NULL,      -- ISO timestamp
  ip               TEXT,               -- IP de la clienta (CF-Connecting-IP)
  user_agent       TEXT,
  producto         TEXT,               -- handle/título del producto
  marketing_opt_in INTEGER DEFAULT 0,  -- 1 si autorizó marketing
  finalidad        TEXT                -- finalidad declarada del tratamiento
);

CREATE TABLE IF NOT EXISTS rate_limit (
  k TEXT PRIMARY KEY,                  -- "ip|YYYY-MM-DDTHH"
  n INTEGER NOT NULL DEFAULT 0         -- generaciones esa hora
);
