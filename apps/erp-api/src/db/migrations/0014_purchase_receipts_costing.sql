CREATE TABLE IF NOT EXISTS purchase_receipts (
  id TEXT PRIMARY KEY NOT NULL,
  external_ref TEXT,
  purchase_order_id TEXT REFERENCES purchase_orders(id),
  supplier_id TEXT REFERENCES suppliers(id),
  issue_date TEXT NOT NULL,
  received_at TEXT NOT NULL,
  document_number TEXT,
  document_type TEXT NOT NULL DEFAULT 'manual',
  source_system TEXT,
  notes TEXT,
  metadata_json TEXT DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS purchase_receipts_external_ref_idx
  ON purchase_receipts(external_ref);
CREATE INDEX IF NOT EXISTS purchase_receipts_supplier_idx
  ON purchase_receipts(supplier_id);
CREATE INDEX IF NOT EXISTS purchase_receipts_purchase_order_idx
  ON purchase_receipts(purchase_order_id);
CREATE INDEX IF NOT EXISTS purchase_receipts_received_at_idx
  ON purchase_receipts(received_at);

CREATE TABLE IF NOT EXISTS purchase_receipt_items (
  id TEXT PRIMARY KEY NOT NULL,
  purchase_receipt_id TEXT NOT NULL REFERENCES purchase_receipts(id),
  purchase_order_item_id TEXT REFERENCES purchase_order_items(id),
  product_id TEXT REFERENCES products(id),
  description TEXT,
  purchased_quantity REAL NOT NULL,
  purchase_unit TEXT NOT NULL,
  conversion_factor_to_stock_unit REAL NOT NULL,
  stock_quantity REAL NOT NULL,
  stock_unit TEXT NOT NULL,
  gross_amount_cents INTEGER NOT NULL,
  discount_amount_cents INTEGER NOT NULL DEFAULT 0,
  freight_amount_cents INTEGER NOT NULL DEFAULT 0,
  tax_amount_cents INTEGER NOT NULL DEFAULT 0,
  other_cost_amount_cents INTEGER NOT NULL DEFAULT 0,
  total_cost_cents INTEGER NOT NULL,
  unit_cost_decimal REAL NOT NULL,
  notes TEXT,
  metadata_json TEXT DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS purchase_receipt_items_receipt_idx
  ON purchase_receipt_items(purchase_receipt_id);
CREATE INDEX IF NOT EXISTS purchase_receipt_items_product_idx
  ON purchase_receipt_items(product_id);

CREATE TABLE IF NOT EXISTS inventory_valuation_events (
  id TEXT PRIMARY KEY NOT NULL,
  product_id TEXT NOT NULL REFERENCES products(id),
  source_type TEXT NOT NULL,
  source_id TEXT,
  quantity_before REAL NOT NULL DEFAULT 0,
  value_before_cents INTEGER NOT NULL DEFAULT 0,
  quantity_in REAL NOT NULL DEFAULT 0,
  value_in_cents INTEGER NOT NULL DEFAULT 0,
  quantity_after REAL NOT NULL DEFAULT 0,
  value_after_cents INTEGER NOT NULL DEFAULT 0,
  average_cost_before_decimal REAL,
  average_cost_after_decimal REAL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS inventory_valuation_events_product_idx
  ON inventory_valuation_events(product_id, created_at);

CREATE TABLE IF NOT EXISTS product_cost_snapshots (
  id TEXT PRIMARY KEY NOT NULL,
  product_id TEXT NOT NULL REFERENCES products(id),
  snapshot_date TEXT NOT NULL,
  source TEXT NOT NULL,
  bom_version_id TEXT,
  material_cost_cents INTEGER NOT NULL DEFAULT 0,
  packaging_cost_cents INTEGER NOT NULL DEFAULT 0,
  labor_cost_cents INTEGER NOT NULL DEFAULT 0,
  total_cost_cents INTEGER NOT NULL DEFAULT 0,
  component_costs_json TEXT DEFAULT '[]',
  metadata_json TEXT DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS product_cost_snapshots_product_idx
  ON product_cost_snapshots(product_id, snapshot_date);

ALTER TABLE products ADD COLUMN average_cost_decimal REAL;
ALTER TABLE products ADD COLUMN average_cost_unit TEXT;
ALTER TABLE products ADD COLUMN last_purchase_cost_decimal REAL;
ALTER TABLE products ADD COLUMN last_purchase_date TEXT;
ALTER TABLE products ADD COLUMN cost_source TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE products ADD COLUMN cost_updated_at TEXT;
