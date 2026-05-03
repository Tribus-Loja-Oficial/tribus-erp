-- Product costing: acquisition fields, composition packaging channel, production profile table.

-- ─── Products: custo proporcional (matéria-prima) ───────────────────────────

ALTER TABLE products ADD COLUMN purchase_unit TEXT;
ALTER TABLE products ADD COLUMN purchase_quantity REAL;
ALTER TABLE products ADD COLUMN consumption_unit TEXT;
ALTER TABLE products ADD COLUMN acquisition_cost_cents INTEGER;
ALTER TABLE products ADD COLUMN cost_per_consumption_unit_cents REAL;

-- ─── Produção (tabela dedicada; copia dados atuais de products) ───────────────

CREATE TABLE IF NOT EXISTS product_production_profiles (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL UNIQUE REFERENCES products (id),
  produced_internally INTEGER NOT NULL DEFAULT 0,
  average_production_time_minutes INTEGER,
  labor_cost_per_hour_cents INTEGER,
  labor_cost_calculated_cents INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO product_production_profiles (
  id,
  product_id,
  produced_internally,
  average_production_time_minutes,
  labor_cost_per_hour_cents,
  labor_cost_calculated_cents,
  notes,
  created_at,
  updated_at
)
SELECT
  'pp_' || lower(hex(randomblob(16))),
  p.id,
  COALESCE(p.produced_internally, 0),
  p.average_production_time_minutes,
  NULL,
  NULL,
  NULL,
  datetime('now'),
  datetime('now')
FROM products p
WHERE
  NOT EXISTS (
    SELECT 1
    FROM product_production_profiles x
    WHERE
      x.product_id = p.id
  );

-- ─── product_compositions: canal de embalagem, unidade, snapshots ─────────────

PRAGMA foreign_keys = OFF;

CREATE TABLE product_compositions__new (
  id TEXT PRIMARY KEY,
  parent_product_id TEXT NOT NULL REFERENCES products (id),
  child_product_id TEXT NOT NULL REFERENCES products (id),
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
    OR (composition_type = 'packaging' AND packaging_channel IN ('online', 'presential'))
    OR (
      composition_type NOT IN ('bom', 'packaging')
      AND packaging_channel IS NULL
    )
  )
);

INSERT INTO product_compositions__new (
  id,
  parent_product_id,
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
)
SELECT
  id,
  parent_product_id,
  child_product_id,
  quantity,
  NULL,
  composition_type,
  CASE
    WHEN composition_type = 'packaging' THEN 'online'
    ELSE NULL
  END,
  NULL,
  NULL,
  required,
  is_default,
  notes,
  created_at,
  updated_at,
  archived_at
FROM
  product_compositions;

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

INSERT OR IGNORE INTO schema_migrations (version) VALUES ('0009_product_costing_composition');
