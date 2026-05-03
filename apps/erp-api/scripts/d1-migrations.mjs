/**
 * Catálogo das migrations D1 do Tribus ERP.
 *
 * O apply oficial continua a ser Wrangler (`migrations_dir` em wrangler.toml):
 *   npm run db:migrate:local
 *   npm run db:migrate:remote
 *
 * Este ficheiro (.mjs) existe para documentação e para garantir que nada na pasta
 * `src/db/migrations/` fica de fora do inventário — ver `npm run db:migrations:verify`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, "..", "src", "db", "migrations");

/** Ordem de aplicação (prefixo numérico). Manter alinhado com os ficheiros .sql. */
export const MIGRATIONS = [
  "0001_init",
  "0002_seed_cash_register",
  "0003_purchases",
  "0004_tags_bom_production",
  "0005_users",
  "0006_seed_admin",
  "0007_products_operational",
  "0008_seed_operational_products",
  "0009_product_costing_composition",
];

function sqlBasenamesOnDisk() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => f.replace(/\.sql$/i, ""))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function verify() {
  const onDisk = new Set(sqlBasenamesOnDisk());
  const inCatalog = new Set(MIGRATIONS);

  const missingInCatalog = [...onDisk].filter((id) => !inCatalog.has(id));
  const missingOnDisk = MIGRATIONS.filter((id) => !onDisk.has(id));

  if (missingInCatalog.length || missingOnDisk.length) {
    console.error("Migrations catalog out of sync with src/db/migrations/.\n");
    if (missingInCatalog.length) {
      console.error("Present on disk but missing from MIGRATIONS in d1-migrations.mjs:");
      missingInCatalog.forEach((id) => console.error(`  - ${id}.sql`));
    }
    if (missingOnDisk.length) {
      console.error("Listed in MIGRATIONS but no matching .sql on disk:");
      missingOnDisk.forEach((id) => console.error(`  - ${id}.sql`));
    }
    process.exit(1);
  }

  for (let i = 1; i < MIGRATIONS.length; i++) {
    if (MIGRATIONS[i].localeCompare(MIGRATIONS[i - 1], undefined, { numeric: true }) < 0) {
      console.error("MIGRATIONS array is not in numeric order.");
      process.exit(1);
    }
  }

  console.log(`OK: ${MIGRATIONS.length} migrations catalogued and present on disk.`);
}

function list() {
  console.log("Migrations (apply with: npm run db:migrate:local|remote)\n");
  MIGRATIONS.forEach((id, i) => console.log(`${String(i + 1).padStart(2)}. ${id}.sql`));
}

const cmd = process.argv[2] ?? "list";
if (cmd === "verify") verify();
else list();
