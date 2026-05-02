-- Optional demo catalog (INSERT OR IGNORE). Apply after 0007. Adjust or skip in production.

-- Demo SKUs — ids fixed for stable composition references
INSERT OR IGNORE INTO products (
  id, sku, name, slug, product_type, status, unit_of_measure,
  cost_price_cents, sale_price_cents, controls_stock, sellable,
  current_stock, min_stock, images_json, attributes_json, metadata_json,
  created_at, updated_at
) VALUES
  ('demo-prd-pulseira', 'IMP-PULSEIRA', 'Pulseira Impulso', 'pulseira-impulso', 'finished_product', 'draft', 'unit', 1500, 7900, 1, 1, 0, 0, '[]', '{}', '{}', datetime('now'), datetime('now')),
  ('demo-prd-colar', 'IMP-COLAR', 'Colar Impulso', 'colar-impulso', 'finished_product', 'draft', 'unit', 2800, 12900, 1, 1, 0, 0, '[]', '{}', '{}', datetime('now'), datetime('now')),
  ('demo-prd-saquinho', 'EMB-SAQ-P', 'Saquinho Kraft Pequeno', 'saquinho-kraft-pequeno', 'packaging', 'active', 'unit', 15, 0, 1, 0, 200, 50, '[]', '{}', '{}', datetime('now'), datetime('now')),
  ('demo-prd-tag', 'EMB-TAG', 'Tag Tribus', 'tag-tribus', 'packaging', 'active', 'unit', 8, 0, 1, 0, 500, 100, '[]', '{}', '{}', datetime('now'), datetime('now')),
  ('demo-prd-cartao', 'EMB-CARTAO', 'Cartão de Agradecimento', 'cartao-agradecimento', 'packaging', 'active', 'unit', 5, 0, 1, 0, 500, 100, '[]', '{}', '{}', datetime('now'), datetime('now')),
  ('demo-prd-fio', 'MP-FIO-PRETO', 'Fio Encerado Preto', 'fio-encerado-preto', 'raw_material', 'active', 'meter', 120, 0, 1, 0, 100, 20, '[]', '{}', '{}', datetime('now'), datetime('now')),
  ('demo-prd-pingente', 'MP-PING-INOX', 'Pingente Inox', 'pingente-inox', 'raw_material', 'active', 'unit', 350, 0, 1, 0, 80, 10, '[]', '{}', '{}', datetime('now'), datetime('now'));

INSERT OR IGNORE INTO product_compositions (
  id, parent_product_id, child_product_id, quantity, composition_type,
  required, is_default, created_at, updated_at
) VALUES
  ('demo-comp-p1', 'demo-prd-pulseira', 'demo-prd-saquinho', 1, 'packaging', 1, 1, datetime('now'), datetime('now')),
  ('demo-comp-p2', 'demo-prd-pulseira', 'demo-prd-tag', 1, 'packaging', 1, 1, datetime('now'), datetime('now')),
  ('demo-comp-p3', 'demo-prd-pulseira', 'demo-prd-cartao', 1, 'packaging', 1, 1, datetime('now'), datetime('now')),
  ('demo-comp-c1', 'demo-prd-colar', 'demo-prd-fio', 1, 'bom', 1, 1, datetime('now'), datetime('now')),
  ('demo-comp-c2', 'demo-prd-colar', 'demo-prd-pingente', 1, 'bom', 1, 1, datetime('now'), datetime('now'));

INSERT OR IGNORE INTO schema_migrations (version) VALUES ('0008_seed_operational_products');
