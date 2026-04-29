-- Migration: 0004_tags_bom_production
-- Product tags, Bill of Materials e módulo de produção

-- ─── Product Tags ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS product_tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS product_tag_assignments (
  product_id TEXT NOT NULL REFERENCES products (id),
  tag_id TEXT NOT NULL REFERENCES product_tags (id),
  PRIMARY KEY (product_id, tag_id)
);

-- ─── Bill of Materials ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bill_of_materials (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products (id),
  version TEXT NOT NULL DEFAULT '1.0',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('draft', 'active', 'archived')),
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE INDEX IF NOT EXISTS bom_product_idx ON bill_of_materials (product_id);

CREATE TABLE IF NOT EXISTS bom_items (
  id TEXT PRIMARY KEY,
  bom_id TEXT NOT NULL REFERENCES bill_of_materials (id),
  component_product_id TEXT NOT NULL REFERENCES products (id),
  quantity REAL NOT NULL,
  unit TEXT NOT NULL DEFAULT 'un',
  unit_cost_cents INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS bom_items_bom_idx ON bom_items (bom_id);

-- ─── Production Orders ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS production_orders (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products (id),
  bom_id TEXT REFERENCES bill_of_materials (id),
  order_number TEXT NOT NULL UNIQUE,
  quantity_planned INTEGER NOT NULL,
  quantity_produced INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  started_at TEXT,
  completed_at TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE INDEX IF NOT EXISTS production_orders_status_idx ON production_orders (status);
CREATE INDEX IF NOT EXISTS production_orders_product_idx ON production_orders (product_id);

CREATE TABLE IF NOT EXISTS production_order_consumptions (
  id TEXT PRIMARY KEY,
  production_order_id TEXT NOT NULL REFERENCES production_orders (id),
  product_id TEXT NOT NULL REFERENCES products (id),
  quantity_planned REAL NOT NULL,
  quantity_consumed REAL NOT NULL DEFAULT 0,
  unit_cost_cents INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS production_order_losses (
  id TEXT PRIMARY KEY,
  production_order_id TEXT NOT NULL REFERENCES production_orders (id),
  product_id TEXT NOT NULL REFERENCES products (id),
  quantity REAL NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL
);

INSERT INTO schema_migrations (version) VALUES ('0004_tags_bom_production');
