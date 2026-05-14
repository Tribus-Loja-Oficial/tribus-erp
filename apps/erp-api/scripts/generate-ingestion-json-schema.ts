/**
 * Gera JSON Schema (draft 2020-12) a partir dos validadores Zod reais de ingestão.
 * Embute também `docs/examples/ingestion/*.json` e `ingestion-field-guide.md` para um único artefacto (copy-paste para IA).
 * Saída: ../erp-web/public/ingestion-payload.schema.json
 */
import { writeFileSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ingestionPayloadSchema } from "../src/schemas/ingestion.schemas.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootApi = join(__dirname, "..");
const repoRoot = join(rootApi, "..", "..");
const outPath = join(rootApi, "..", "erp-web", "public", "ingestion-payload.schema.json");
const examplesDir = join(repoRoot, "docs", "examples", "ingestion");
const fieldGuidePath = join(repoRoot, "docs", "reference", "ingestion-field-guide.md");

function loadOfficialExamples(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  try {
    const names = readdirSync(examplesDir).filter((f) => f.endsWith(".json"));
    for (const name of names) {
      const key = name.replace(/\.json$/i, "");
      const raw = readFileSync(join(examplesDir, name), "utf8");
      out[key] = JSON.parse(raw) as unknown;
    }
  } catch {
    console.warn("No examples dir or failed to read:", examplesDir);
  }
  return out;
}

function loadFieldGuideMarkdown(): string {
  try {
    return readFileSync(fieldGuidePath, "utf8");
  } catch {
    console.warn("ingestion-field-guide.md not found:", fieldGuidePath);
    return "";
  }
}

/** `$refStrategy: "relative"` gera paths como "3/0/..." que não são JSON Pointer válidos para ferramentas externas. */
const generated = zodToJsonSchema(ingestionPayloadSchema, {
  name: "IngestionPayload",
  target: "jsonSchema2020-12",
  $refStrategy: "none",
}) as Record<string, unknown>;

const envelope: Record<string, unknown> = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://tribus-erp.local/schemas/ingestion-payload-1.0.json",
  title: "Tribus ERP — Ingestion payload (gerado a partir de ingestionPayloadSchema Zod)",
  description:
    "Pacote único para IA: inclui schema Zod (definitions), instruções x-ai-instructions, " +
    "payloads de exemplo em x-official-examples e documentação em Markdown em x-documentation-markdown. " +
    "Fonte Zod: apps/erp-api/src/schemas/ingestion.schemas.ts. Regenerar: npm run generate:ingestion-schema.",
  "x-ai-instructions": [
    "Never infer enum values; use only enums declared in this schema (generated from Zod).",
    "Monetary fields are integer cents only (salePriceCents, costPriceCents, unitPriceCents, …).",
    "WooCommerce publish → ERP status active; never send publish.",
    "Use productType finished_product for finished goods; never finished_good.",
    "Initial or legacy stock: inventory_movement.type must be adjustment; never initial_stock.",
    "productKind variable requires product_variant rows; stock/order lines use variantRef or variantId for that parent.",
    "client_ref identifies objects within the payload; *Ref fields point to client_ref; *Id fields are existing UUIDs.",
    "Only ingestion image fields use snake_case: main_image_url, gallery_image_urls; all other data fields are camelCase.",
    "compositionType (bom, packaging, …) is not the same as productType (finished_product, raw_material, …).",
    "Put importer-specific or non-modelled data under metadata (object); do not invent top-level keys — product.data is strict.",
    "externalRef (PRD-/PRV-) is assigned by the server on create; do not send unless the API explicitly supports it.",
    "action field (envelope, per-object, optional): 'skip' (default) = insert if not exists, ignore if exists; 'upsert' = merge-patch if exists (only sent fields updated, omitted fields untouched), create if not exists.",
    "action 'upsert' natural keys: category → slug, collection → slug, product → slug OR sku (at least one required in data).",
    "action 'upsert' data schema is partial (only natural key required); action 'skip'/'omitted' data schema is full (all required fields must be present).",
    "Types without upsert support (stock_location, party, customer, supplier, product_variant, product_composition, inventory_movement, order, purchase_order): action field is accepted but ignored at runtime.",
    'product_composition_set requires action "replace": archives existing composition rows in scope (replaceTypes, optional packagingChannel filter) and inserts items in one D1 batch; use product_composition for single-line append.',
    "Response items[].status values: 'created' (new insert), 'updated' (upsert patch applied), 'skipped' (existed, skip action), 'failed' (error).",
    "product_cost_snapshot: totalCostCents must equal materialCostCents + packagingCostCents + laborCostCents; if componentCosts is non-empty, sum of lineTotalCents must equal materialCostCents + packagingCostCents (composition lines only, not labor).",
  ],
};

const officialExamples = loadOfficialExamples();
const fieldGuideMd = loadFieldGuideMarkdown();

const merged = {
  ...envelope,
  /** Payloads válidos (pastas docs/examples/ingestion); mesmos ficheiros versionados no repo. */
  "x-official-examples": officialExamples,
  /** Cópia embutida de docs/reference/ingestion-field-guide.md (enums, WooCommerce, regras). */
  "x-documentation-markdown": fieldGuideMd,
  ...generated,
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(merged, null, 2) + "\n", "utf8");
console.log("Wrote", outPath);
