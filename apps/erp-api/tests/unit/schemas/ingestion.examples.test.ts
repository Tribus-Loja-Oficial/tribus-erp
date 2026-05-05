import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ingestionPayloadSchema } from "../../../src/schemas/ingestion.schemas.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const examplesDir = join(__dirname, "../../../../../docs/examples/ingestion");

describe("docs/examples/ingestion/*.json", () => {
  const files = readdirSync(examplesDir).filter((f) => f.endsWith(".json"));

  it.each(files)("passes ingestionPayloadSchema: %s", (file) => {
    const raw = readFileSync(join(examplesDir, file), "utf8");
    const json = JSON.parse(raw) as unknown;
    const result = ingestionPayloadSchema.safeParse(json);
    expect(result.success, JSON.stringify(result.success ? "" : result.error.flatten())).toBe(true);
  });
});
