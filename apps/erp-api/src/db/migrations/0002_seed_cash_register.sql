-- Default cash register for PDV (idempotent)
INSERT OR IGNORE INTO cash_registers (id, name, location, status, created_at, updated_at)
VALUES (
  'reg_pdv_principal',
  'PDV Principal',
  'Loja',
  'active',
  datetime('now'),
  datetime('now')
);

-- Default financial account for lançamentos (idempotent)
INSERT OR IGNORE INTO financial_accounts (
  id, name, type, institution, currency,
  opening_balance_cents, current_balance_cents, is_active, created_at, updated_at
)
VALUES (
  'fin_caixa_principal',
  'Caixa Principal',
  'cash',
  NULL,
  'BRL',
  0,
  0,
  1,
  datetime('now'),
  datetime('now')
);
