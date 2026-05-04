-- product_kind (simple | variable), product_variants remodel + external_ref PRV-NNNN,
-- composição preparada para parent_variant_id / child_variant_id.

PRAGMA foreign_keys = OFF;

ALTER TABLE products ADD COLUMN product_kind TEXT NOT NULL DEFAULT 'simple';

CREATE TABLE product_variants__new (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products (id),
  external_ref TEXT NOT NULL,
  sku TEXT NOT NULL,
  name TEXT,
  attributes_json TEXT DEFAULT '{}',
  sale_price_cents INTEGER,
  cost_price_cents INTEGER,
  promotional_price_cents INTEGER,
  event_price_cents INTEGER,
  wholesale_price_cents INTEGER,
  controls_stock INTEGER NOT NULL DEFAULT 1,
  current_stock INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 0,
  ideal_stock INTEGER,
  barcode TEXT,
  weight_grams INTEGER,
  length_cm REAL,
  width_cm REAL,
  height_cm REAL,
  main_image_file_id TEXT,
  metadata_json TEXT DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT,
  deleted_at TEXT
);

INSERT INTO product_variants__new (
  id,
  product_id,
  external_ref,
  sku,
  name,
  attributes_json,
  sale_price_cents,
  cost_price_cents,
  promotional_price_cents,
  event_price_cents,
  wholesale_price_cents,
  controls_stock,
  current_stock,
  min_stock,
  ideal_stock,
  barcode,
  weight_grams,
  length_cm,
  width_cm,
  height_cm,
  main_image_file_id,
  metadata_json,
  status,
  created_at,
  updated_at,
  archived_at,
  deleted_at
)
SELECT
  v.id,
  v.product_id,
  'PRV-' || printf('%04d', ROW_NUMBER() OVER (ORDER BY v.created_at ASC, v.id ASC)),
  v.sku,
  NULLIF(TRIM(v.name), ''),
  COALESCE(v.attributes_json, '{}'),
  v.sale_price_cents,
  v.cost_price_cents,
  NULL,
  NULL,
  NULL,
  1,
  v.current_stock,
  0,
  NULL,
  v.barcode,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  '{}',
  CASE
    WHEN v.status = 'inactive' THEN 'inactive'
    ELSE 'active'
  END,
  v.created_at,
  v.updated_at,
  v.archived_at,
  NULL
FROM product_variants v;

DROP TABLE product_variants;
ALTER TABLE product_variants__new RENAME TO product_variants;

CREATE UNIQUE INDEX IF NOT EXISTS product_variants_sku_uq ON product_variants (sku);
CREATE UNIQUE INDEX IF NOT EXISTS product_variants_external_ref_uq ON product_variants (external_ref);
CREATE INDEX IF NOT EXISTS product_variants_product_idx ON product_variants (product_id);

ALTER TABLE product_compositions ADD COLUMN parent_variant_id TEXT REFERENCES product_variants (id);
ALTER TABLE product_compositions ADD COLUMN child_variant_id TEXT REFERENCES product_variants (id);

PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO schema_migrations (version) VALUES ('0011_product_kind_variants');
