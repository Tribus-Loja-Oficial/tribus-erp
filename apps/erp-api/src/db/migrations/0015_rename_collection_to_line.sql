PRAGMA foreign_keys = OFF;

ALTER TABLE product_collections RENAME TO product_lines;

ALTER TABLE products RENAME COLUMN collection_id TO line_id;

-- Tabela reservada para "coleção" futura (sem FK em products).
CREATE TABLE IF NOT EXISTS product_collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO schema_migrations (version) VALUES ('0015_rename_collection_to_line');
