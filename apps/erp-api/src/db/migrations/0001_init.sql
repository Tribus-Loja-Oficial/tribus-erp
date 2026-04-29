-- Migration: 0001_init
-- Tribus ERP — Schema inicial completo

-- Rastreamento de migrations
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Parties ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS parties (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('individual', 'company')),
  legal_name TEXT NOT NULL,
  trade_name TEXT,
  document_type TEXT NOT NULL DEFAULT 'unknown'
    CHECK (document_type IN ('cpf', 'cnpj', 'foreign', 'unknown')),
  document_number TEXT,
  email TEXT,
  phone TEXT,
  notes TEXT,
  cds_consumer_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE INDEX IF NOT EXISTS parties_document_idx ON parties (document_number);
CREATE INDEX IF NOT EXISTS parties_email_idx ON parties (email);

CREATE TABLE IF NOT EXISTS party_addresses (
  id TEXT PRIMARY KEY,
  party_id TEXT NOT NULL REFERENCES parties (id),
  label TEXT NOT NULL DEFAULT 'principal',
  street TEXT NOT NULL,
  number TEXT,
  complement TEXT,
  neighborhood TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'BR',
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- ─── Customers & Suppliers ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  party_id TEXT NOT NULL REFERENCES parties (id),
  cds_consumer_id TEXT,
  origin TEXT NOT NULL DEFAULT 'manual'
    CHECK (origin IN ('ecommerce', 'event', 'manual', 'imported')),
  first_purchase_at TEXT,
  last_purchase_at TEXT,
  total_orders INTEGER NOT NULL DEFAULT 0,
  total_spent_cents INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'blocked')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  party_id TEXT NOT NULL REFERENCES parties (id),
  state_registration TEXT,
  municipal_registration TEXT,
  contact_name TEXT,
  website TEXT,
  marketplace TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

-- ─── Products ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS product_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  parent_id TEXT,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE TABLE IF NOT EXISTS product_collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  niche TEXT,
  season TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  short_description TEXT,
  product_type TEXT NOT NULL DEFAULT 'simple'
    CHECK (product_type IN ('simple', 'kit', 'bundle', 'service', 'raw_material')),
  category_id TEXT REFERENCES product_categories (id),
  collection_id TEXT REFERENCES product_collections (id),
  niche TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'inactive', 'archived')),
  unit_of_measure TEXT NOT NULL DEFAULT 'un',
  barcode TEXT,
  ncm TEXT,
  cest TEXT,
  cfop_default TEXT,
  origin TEXT DEFAULT '0',
  cost_price_cents INTEGER NOT NULL DEFAULT 0,
  sale_price_cents INTEGER NOT NULL DEFAULT 0,
  compare_at_price_cents INTEGER,
  current_stock INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 0,
  max_stock INTEGER,
  weight_grams INTEGER,
  height_cm REAL,
  width_cm REAL,
  depth_cm REAL,
  images_json TEXT DEFAULT '[]',
  attributes_json TEXT DEFAULT '{}',
  metadata_json TEXT DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE INDEX IF NOT EXISTS products_status_idx ON products (status);
CREATE INDEX IF NOT EXISTS products_category_idx ON products (category_id);
CREATE INDEX IF NOT EXISTS products_sku_idx ON products (sku);

CREATE TABLE IF NOT EXISTS product_variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products (id),
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  attributes_json TEXT DEFAULT '{}',
  sale_price_cents INTEGER NOT NULL DEFAULT 0,
  cost_price_cents INTEGER NOT NULL DEFAULT 0,
  current_stock INTEGER NOT NULL DEFAULT 0,
  barcode TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

-- ─── Inventory ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stock_locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'main'
    CHECK (type IN ('main', 'event', 'production', 'damaged', 'reserved', 'third_party')),
  address TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products (id),
  variant_id TEXT REFERENCES product_variants (id),
  location_id TEXT NOT NULL REFERENCES stock_locations (id),
  type TEXT NOT NULL CHECK (type IN (
    'purchase', 'sale', 'return', 'adjustment',
    'production_in', 'production_out',
    'transfer_in', 'transfer_out',
    'damaged', 'reservation', 'release_reservation'
  )),
  quantity INTEGER NOT NULL,
  unit_cost_cents INTEGER,
  reference_type TEXT,
  reference_id TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS stock_movements_product_idx ON stock_movements (product_id);
CREATE INDEX IF NOT EXISTS stock_movements_location_idx ON stock_movements (location_id);
CREATE INDEX IF NOT EXISTS stock_movements_created_at_idx ON stock_movements (created_at);

-- ─── Orders ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  channel TEXT NOT NULL DEFAULT 'manual'
    CHECK (channel IN ('ecommerce', 'pos', 'manual', 'event', 'marketplace')),
  source_system TEXT NOT NULL DEFAULT 'manual'
    CHECK (source_system IN ('tribus-commerce', 'woocommerce', 'manual', 'pdv')),
  source_external_id TEXT,
  customer_id TEXT REFERENCES customers (id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'pending_payment', 'paid', 'preparing',
    'shipped', 'delivered', 'cancelled', 'refunded'
  )),
  payment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'paid', 'partial', 'refunded', 'failed')),
  fulfillment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (fulfillment_status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  discount_total_cents INTEGER NOT NULL DEFAULT 0,
  shipping_total_cents INTEGER NOT NULL DEFAULT 0,
  tax_total_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  notes TEXT,
  metadata_json TEXT DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);
CREATE INDEX IF NOT EXISTS orders_customer_idx ON orders (customer_id);
CREATE INDEX IF NOT EXISTS orders_channel_idx ON orders (channel);
CREATE UNIQUE INDEX IF NOT EXISTS orders_source_external_idx ON orders (source_system, source_external_id)
  WHERE source_external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders (id),
  product_id TEXT REFERENCES products (id),
  variant_id TEXT REFERENCES product_variants (id),
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders (id),
  method TEXT NOT NULL CHECK (method IN (
    'cash', 'credit_card', 'debit_card', 'pix',
    'bank_transfer', 'marketplace', 'other'
  )),
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'failed', 'refunded')),
  external_ref TEXT,
  paid_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- ─── PDV / Cash ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cash_registers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cash_sessions (
  id TEXT PRIMARY KEY,
  cash_register_id TEXT NOT NULL REFERENCES cash_registers (id),
  opened_by TEXT NOT NULL,
  opened_at TEXT NOT NULL,
  opening_amount_cents INTEGER NOT NULL DEFAULT 0,
  closed_by TEXT,
  closed_at TEXT,
  closing_amount_cents INTEGER,
  expected_amount_cents INTEGER,
  difference_amount_cents INTEGER,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed', 'reconciled')),
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS cash_sessions_status_idx ON cash_sessions (status);

CREATE TABLE IF NOT EXISTS cash_movements (
  id TEXT PRIMARY KEY,
  cash_session_id TEXT NOT NULL REFERENCES cash_sessions (id),
  type TEXT NOT NULL CHECK (type IN ('sale', 'refund', 'cash_in', 'cash_out', 'adjustment', 'fee')),
  payment_method TEXT NOT NULL CHECK (payment_method IN (
    'cash', 'credit_card', 'debit_card', 'pix',
    'bank_transfer', 'marketplace', 'other'
  )),
  amount_cents INTEGER NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  notes TEXT,
  created_at TEXT NOT NULL
);

-- ─── Finance ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
  parent_id TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cost_centers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS financial_accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('bank', 'cash', 'credit_card', 'payment_gateway', 'marketplace')),
  institution TEXT,
  currency TEXT NOT NULL DEFAULT 'BRL',
  opening_balance_cents INTEGER NOT NULL DEFAULT 0,
  current_balance_cents INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS financial_entries (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer', 'adjustment')),
  financial_account_id TEXT NOT NULL REFERENCES financial_accounts (id),
  category_id TEXT REFERENCES chart_of_accounts (id),
  cost_center_id TEXT REFERENCES cost_centers (id),
  amount_cents INTEGER NOT NULL,
  date TEXT NOT NULL,
  competence_date TEXT,
  description TEXT NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  document_id TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS financial_entries_date_idx ON financial_entries (date);
CREATE INDEX IF NOT EXISTS financial_entries_type_idx ON financial_entries (type);
CREATE INDEX IF NOT EXISTS financial_entries_account_idx ON financial_entries (financial_account_id);

CREATE TABLE IF NOT EXISTS accounts_payable (
  id TEXT PRIMARY KEY,
  supplier_id TEXT REFERENCES suppliers (id),
  description TEXT NOT NULL,
  due_date TEXT NOT NULL,
  competence_date TEXT,
  amount_cents INTEGER NOT NULL,
  paid_amount_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'partially_paid', 'paid', 'overdue', 'cancelled')),
  category_id TEXT REFERENCES chart_of_accounts (id),
  cost_center_id TEXT REFERENCES cost_centers (id),
  payment_method TEXT,
  document_id TEXT,
  notes TEXT,
  paid_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE INDEX IF NOT EXISTS accounts_payable_due_date_idx ON accounts_payable (due_date);
CREATE INDEX IF NOT EXISTS accounts_payable_status_idx ON accounts_payable (status);

CREATE TABLE IF NOT EXISTS accounts_receivable (
  id TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES customers (id),
  order_id TEXT REFERENCES orders (id),
  description TEXT NOT NULL,
  due_date TEXT NOT NULL,
  competence_date TEXT,
  amount_cents INTEGER NOT NULL,
  received_amount_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'partially_received', 'received', 'overdue', 'cancelled')),
  payment_method TEXT,
  notes TEXT,
  received_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE INDEX IF NOT EXISTS accounts_receivable_due_date_idx ON accounts_receivable (due_date);
CREATE INDEX IF NOT EXISTS accounts_receivable_status_idx ON accounts_receivable (status);

-- ─── Fiscal ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fiscal_documents (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('nfe', 'nfce', 'nfse', 'cte', 'other')),
  access_key TEXT UNIQUE,
  number TEXT,
  series TEXT,
  issue_date TEXT NOT NULL,
  emitter_party_id TEXT REFERENCES parties (id),
  recipient_party_id TEXT REFERENCES parties (id),
  total_amount_cents INTEGER NOT NULL DEFAULT 0,
  xml_file_id TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'cancelled', 'pending')),
  raw_xml_storage_key TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS fiscal_documents_type_idx ON fiscal_documents (type);
CREATE INDEX IF NOT EXISTS fiscal_documents_issue_date_idx ON fiscal_documents (issue_date);

CREATE TABLE IF NOT EXISTS fiscal_document_items (
  id TEXT PRIMARY KEY,
  fiscal_document_id TEXT NOT NULL REFERENCES fiscal_documents (id),
  product_id TEXT REFERENCES products (id),
  description TEXT NOT NULL,
  ncm TEXT,
  cfop TEXT,
  quantity REAL NOT NULL,
  unit_value REAL NOT NULL,
  total_value REAL NOT NULL,
  created_at TEXT NOT NULL
);

-- ─── Documents ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS document_files (
  id TEXT PRIMARY KEY,
  storage_key TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  checksum TEXT,
  reference_type TEXT,
  reference_id TEXT,
  uploaded_by TEXT,
  metadata_json TEXT DEFAULT '{}',
  created_at TEXT NOT NULL
);

-- ─── Audit & Integration ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  actor_type TEXT NOT NULL DEFAULT 'user'
    CHECK (actor_type IN ('user', 'system', 'api')),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  metadata_json TEXT,
  request_id TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs (created_at);
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON audit_logs (actor_id);

CREATE TABLE IF NOT EXISTS integration_events (
  id TEXT PRIMARY KEY,
  source_system TEXT NOT NULL,
  event_type TEXT NOT NULL,
  external_id TEXT,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processed', 'failed', 'skipped')),
  error_message TEXT,
  processed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS integration_events_status_idx ON integration_events (status);
CREATE UNIQUE INDEX IF NOT EXISTS integration_events_external_idx
  ON integration_events (source_system, event_type, external_id)
  WHERE external_id IS NOT NULL;

-- ─── Seed: plano de contas básico ───────────────────────────────────────────

INSERT OR IGNORE INTO chart_of_accounts (id, code, name, type, created_at, updated_at) VALUES
  ('coa_receita_vendas',    '4.1.1', 'Receita de Vendas',        'revenue',  datetime('now'), datetime('now')),
  ('coa_receita_servicos',  '4.1.2', 'Receita de Serviços',      'revenue',  datetime('now'), datetime('now')),
  ('coa_custo_mercadoria',  '5.1.1', 'Custo de Mercadoria',      'expense',  datetime('now'), datetime('now')),
  ('coa_frete',             '5.1.2', 'Frete',                    'expense',  datetime('now'), datetime('now')),
  ('coa_taxas',             '5.1.3', 'Taxas e Comissões',        'expense',  datetime('now'), datetime('now')),
  ('coa_mkt',               '5.2.1', 'Marketing',                'expense',  datetime('now'), datetime('now')),
  ('coa_operacional',       '5.2.2', 'Despesas Operacionais',    'expense',  datetime('now'), datetime('now')),
  ('coa_impostos',          '5.3.1', 'Impostos',                 'expense',  datetime('now'), datetime('now'));

INSERT OR IGNORE INTO cost_centers (id, name, created_at, updated_at) VALUES
  ('cc_producao',    'Produção',       datetime('now'), datetime('now')),
  ('cc_marketing',   'Marketing',      datetime('now'), datetime('now')),
  ('cc_eventos',     'Eventos',        datetime('now'), datetime('now')),
  ('cc_operacao',    'Operação',       datetime('now'), datetime('now')),
  ('cc_admin',       'Administrativo', datetime('now'), datetime('now'));

INSERT OR IGNORE INTO stock_locations (id, name, type, created_at, updated_at) VALUES
  ('loc_principal', 'Estoque Principal', 'main',       datetime('now'), datetime('now')),
  ('loc_evento',    'Estoque Evento',    'event',      datetime('now'), datetime('now')),
  ('loc_defeito',   'Peças com Defeito', 'damaged',    datetime('now'), datetime('now'));

INSERT INTO schema_migrations (version) VALUES ('0001_init');
