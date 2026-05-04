-- Referência humana estável por produto (estilo Hub: PRD-NNNN).

ALTER TABLE products ADD COLUMN external_ref TEXT;

UPDATE products
SET
  external_ref = (
    SELECT 'PRD-' || printf('%04d', x.rn)
    FROM (
      SELECT
        id,
        ROW_NUMBER() OVER (
          ORDER BY
            created_at ASC,
            id ASC
        ) AS rn
      FROM products
    ) AS x
    WHERE
      x.id = products.id
  );

CREATE UNIQUE INDEX IF NOT EXISTS products_external_ref_uq ON products (external_ref);

INSERT OR IGNORE INTO schema_migrations (version) VALUES ('0010_product_external_ref');
