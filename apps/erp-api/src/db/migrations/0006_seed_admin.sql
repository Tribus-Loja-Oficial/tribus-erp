-- Seed admin user (password: changeme123!, PBKDF2-SHA256, 100000 iterations)
INSERT OR IGNORE INTO users (id, email, name, password_hash, password_salt, role)
VALUES (
  'admin-001',
  'admin@tribus.com.br',
  'Administrador',
  '7730a9d0eaf4812181220ae0f4dd93d7ba428cc9ad6c1a71befec022ae56aea2',
  '43eb8639fbc2254eaa4ec724c27b1843',
  'admin'
);
