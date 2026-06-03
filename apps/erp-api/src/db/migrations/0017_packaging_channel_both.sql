-- packaging_channel: add 'both' (embalagem válida para online e presencial)

PRAGMA foreign_keys = OFF;

CREATE TABLE line_compositions__new (
  id TEXT PRIMARY KEY,
  parent_line_id TEXT NOT NULL REFERENCES product_lines (id),
  child_product_id TEXT NOT NULL REFERENCES products (id),
  quantity REAL NOT NULL,
  quantity_unit TEXT,
  composition_type TEXT NOT NULL CHECK (
    composition_type IN ('packaging', 'bom', 'kit', 'bundle', 'accessory', 'included')
  ),
  packaging_channel TEXT CHECK (packaging_channel IN ('online', 'presential', 'both')),
  unit_cost_snapshot_cents REAL,
  total_cost_snapshot_cents REAL,
  required INTEGER NOT NULL DEFAULT 1,
  is_default INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

INSERT INTO line_compositions__new
SELECT
  id,
  parent_line_id,
  child_product_id,
  quantity,
  quantity_unit,
  composition_type,
  packaging_channel,
  unit_cost_snapshot_cents,
  total_cost_snapshot_cents,
  required,
  is_default,
  notes,
  created_at,
  updated_at,
  archived_at
FROM line_compositions;

DROP TABLE line_compositions;

ALTER TABLE line_compositions__new RENAME TO line_compositions;

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

CREATE TABLE product_compositions__new (
  id TEXT PRIMARY KEY,
  parent_product_id TEXT NOT NULL REFERENCES products (id),
  parent_variant_id TEXT REFERENCES product_variants (id),
  child_product_id TEXT NOT NULL REFERENCES products (id),
  child_variant_id TEXT REFERENCES product_variants (id),
  quantity REAL NOT NULL,
  quantity_unit TEXT,
  composition_type TEXT NOT NULL,
  packaging_channel TEXT,
  unit_cost_snapshot_cents REAL,
  total_cost_snapshot_cents REAL,
  required INTEGER NOT NULL DEFAULT 1,
  is_default INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT,
  CHECK (quantity > 0),
  CHECK (
    composition_type IN ('packaging', 'bom', 'kit', 'bundle', 'accessory', 'included')
  ),
  CHECK (
    (
      composition_type = 'bom'
      AND packaging_channel IS NULL
    )
    OR (
      composition_type = 'packaging'
      AND packaging_channel IN ('online', 'presential', 'both')
    )
    OR (
      composition_type NOT IN ('bom', 'packaging')
      AND packaging_channel IS NULL
    )
  )
);

INSERT INTO product_compositions__new (
  id,
  parent_product_id,
  parent_variant_id,
  child_product_id,
  child_variant_id,
  quantity,
  quantity_unit,
  composition_type,
  packaging_channel,
  unit_cost_snapshot_cents,
  total_cost_snapshot_cents,
  required,
  is_default,
  notes,
  created_at,
  updated_at,
  archived_at
)
SELECT
  id,
  parent_product_id,
  parent_variant_id,
  child_product_id,
  child_variant_id,
  quantity,
  quantity_unit,
  composition_type,
  packaging_channel,
  unit_cost_snapshot_cents,
  total_cost_snapshot_cents,
  required,
  is_default,
  notes,
  created_at,
  updated_at,
  archived_at
FROM product_compositions;

DROP TABLE product_compositions;

ALTER TABLE product_compositions__new RENAME TO product_compositions;

CREATE INDEX IF NOT EXISTS product_compositions_parent_idx ON product_compositions (parent_product_id);

CREATE INDEX IF NOT EXISTS product_compositions_child_idx ON product_compositions (child_product_id);

CREATE UNIQUE INDEX IF NOT EXISTS product_compositions_bom_active_uq ON product_compositions (parent_product_id, child_product_id)
WHERE
  composition_type = 'bom'
  AND archived_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS product_compositions_packaging_active_uq ON product_compositions (
  parent_product_id,
  child_product_id,
  packaging_channel
)
WHERE
  composition_type = 'packaging'
  AND archived_at IS NULL;

PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO schema_migrations (version) VALUES ('0017_packaging_channel_both');
