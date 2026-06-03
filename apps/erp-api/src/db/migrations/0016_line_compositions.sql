PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS line_compositions (
  id TEXT PRIMARY KEY,
  parent_line_id TEXT NOT NULL REFERENCES product_lines (id),
  child_product_id TEXT NOT NULL REFERENCES products (id),
  quantity REAL NOT NULL,
  quantity_unit TEXT,
  composition_type TEXT NOT NULL CHECK (
    composition_type IN ('packaging', 'bom', 'kit', 'bundle', 'accessory', 'included')
  ),
  packaging_channel TEXT CHECK (packaging_channel IN ('online', 'presential')),
  unit_cost_snapshot_cents REAL,
  total_cost_snapshot_cents REAL,
  required INTEGER NOT NULL DEFAULT 1,
  is_default INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE INDEX IF NOT EXISTS line_compositions_parent_idx ON line_compositions (parent_line_id);

CREATE INDEX IF NOT EXISTS line_compositions_child_idx ON line_compositions (child_product_id);

CREATE UNIQUE INDEX IF NOT EXISTS line_compositions_bom_active_uq ON line_compositions (parent_line_id, child_product_id)
WHERE
  composition_type = 'bom'
  AND archived_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS line_compositions_packaging_active_uq ON line_compositions (
  parent_line_id,
  child_product_id,
  packaging_channel
)
WHERE
  composition_type = 'packaging'
  AND archived_at IS NULL;

PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO schema_migrations (version) VALUES ('0016_line_compositions');
