-- Products: operational model (types, logistics, composition) + product_compositions
-- Migrates legacy product_type 'simple' -> 'finished_product', unit 'un' -> 'unit', depth_cm -> length_cm

-- Nota: não usar BEGIN TRANSACTION / COMMIT aqui — o D1 remoto rejeita com wrangler d1 migrations apply.
PRAGMA foreign_keys = OFF;

ALTER TABLE product_collections ADD COLUMN status TEXT NOT NULL DEFAULT 'active';

CREATE TABLE products__new (
  id TEXT PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  short_description TEXT,
  internal_name TEXT,
  internal_description TEXT,
  product_type TEXT NOT NULL DEFAULT 'finished_product',
  category_id TEXT REFERENCES product_categories (id),
  collection_id TEXT REFERENCES product_collections (id),
  niche TEXT,
  brand TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  unit_of_measure TEXT NOT NULL DEFAULT 'unit',
  barcode TEXT,
  ncm TEXT,
  cest TEXT,
  cfop_default TEXT,
  origin TEXT DEFAULT '0',
  cost_price_cents INTEGER NOT NULL DEFAULT 0,
  sale_price_cents INTEGER NOT NULL DEFAULT 0,
  compare_at_price_cents INTEGER,
  promotional_price_cents INTEGER,
  event_price_cents INTEGER,
  wholesale_price_cents INTEGER,
  controls_stock INTEGER NOT NULL DEFAULT 1,
  current_stock INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 0,
  max_stock INTEGER,
  ideal_stock INTEGER,
  default_stock_location_id TEXT REFERENCES stock_locations (id),
  weight_grams INTEGER,
  length_cm REAL,
  width_cm REAL,
  height_cm REAL,
  produced_internally INTEGER NOT NULL DEFAULT 0,
  average_production_time_minutes INTEGER,
  sellable INTEGER NOT NULL DEFAULT 1,
  available_for_ecommerce INTEGER NOT NULL DEFAULT 1,
  available_for_pos INTEGER NOT NULL DEFAULT 1,
  available_for_events INTEGER NOT NULL DEFAULT 0,
  main_image_file_id TEXT,
  images_json TEXT DEFAULT '[]',
  attributes_json TEXT DEFAULT '{}',
  metadata_json TEXT DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT,
  deleted_at TEXT,
  CHECK (
    product_type IN (
      'finished_product',
      'raw_material',
      'packaging',
      'kit',
      'bundle',
      'service',
      'consumable'
    )
  ),
  CHECK (status IN ('draft', 'active', 'inactive', 'archived'))
);

INSERT INTO products__new (
  id,
  sku,
  name,
  slug,
  description,
  short_description,
  internal_name,
  internal_description,
  product_type,
  category_id,
  collection_id,
  niche,
  brand,
  status,
  unit_of_measure,
  barcode,
  ncm,
  cest,
  cfop_default,
  origin,
  cost_price_cents,
  sale_price_cents,
  compare_at_price_cents,
  promotional_price_cents,
  event_price_cents,
  wholesale_price_cents,
  controls_stock,
  current_stock,
  min_stock,
  max_stock,
  ideal_stock,
  default_stock_location_id,
  weight_grams,
  length_cm,
  width_cm,
  height_cm,
  produced_internally,
  average_production_time_minutes,
  sellable,
  available_for_ecommerce,
  available_for_pos,
  available_for_events,
  main_image_file_id,
  images_json,
  attributes_json,
  metadata_json,
  created_at,
  updated_at,
  archived_at,
  deleted_at
)
SELECT
  id,
  sku,
  name,
  slug,
  description,
  short_description,
  NULL,
  NULL,
  CASE product_type
    WHEN 'simple' THEN 'finished_product'
    ELSE product_type
  END,
  category_id,
  collection_id,
  niche,
  NULL,
  status,
  CASE unit_of_measure
    WHEN 'un' THEN 'unit'
    ELSE unit_of_measure
  END,
  barcode,
  ncm,
  cest,
  cfop_default,
  COALESCE(origin, '0'),
  cost_price_cents,
  sale_price_cents,
  compare_at_price_cents,
  NULL,
  NULL,
  NULL,
  CASE
    WHEN product_type = 'service' THEN 0
    ELSE 1
  END,
  current_stock,
  min_stock,
  max_stock,
  NULL,
  NULL,
  weight_grams,
  depth_cm,
  width_cm,
  height_cm,
  0,
  NULL,
  1,
  1,
  1,
  0,
  NULL,
  images_json,
  attributes_json,
  metadata_json,
  created_at,
  updated_at,
  archived_at,
  NULL
FROM products;

DROP TABLE products;

ALTER TABLE products__new RENAME TO products;

CREATE INDEX IF NOT EXISTS products_status_idx ON products (status);

CREATE INDEX IF NOT EXISTS products_category_idx ON products (category_id);

CREATE INDEX IF NOT EXISTS products_sku_idx ON products (sku);

CREATE TABLE product_compositions (
  id TEXT PRIMARY KEY,
  parent_product_id TEXT NOT NULL REFERENCES products (id),
  child_product_id TEXT NOT NULL REFERENCES products (id),
  quantity REAL NOT NULL,
  composition_type TEXT NOT NULL,
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
  UNIQUE (parent_product_id, child_product_id, composition_type)
);

CREATE INDEX IF NOT EXISTS product_compositions_parent_idx ON product_compositions (parent_product_id);

CREATE INDEX IF NOT EXISTS product_compositions_child_idx ON product_compositions (child_product_id);

PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO schema_migrations (version) VALUES ('0007_products_operational');
