-- Migration: 0003_purchases
-- Módulo de compras e ordens de compra

CREATE TABLE IF NOT EXISTS purchase_orders (
  id TEXT PRIMARY KEY,
  supplier_id TEXT REFERENCES suppliers (id),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'ordered', 'partially_received', 'received', 'cancelled')),
  issue_date TEXT NOT NULL,
  expected_date TEXT,
  total_amount_cents INTEGER NOT NULL DEFAULT 0,
  freight_amount_cents INTEGER NOT NULL DEFAULT 0,
  discount_amount_cents INTEGER NOT NULL DEFAULT 0,
  tax_amount_cents INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE INDEX IF NOT EXISTS purchase_orders_status_idx ON purchase_orders (status);
CREATE INDEX IF NOT EXISTS purchase_orders_supplier_idx ON purchase_orders (supplier_id);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id TEXT PRIMARY KEY,
  purchase_order_id TEXT NOT NULL REFERENCES purchase_orders (id),
  product_id TEXT REFERENCES products (id),
  description TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  total_price_cents INTEGER NOT NULL,
  received_quantity REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS purchase_order_items_order_idx ON purchase_order_items (purchase_order_id);

INSERT INTO schema_migrations (version) VALUES ('0003_purchases');
