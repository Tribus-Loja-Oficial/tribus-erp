import { describe, it, expect } from "vitest";
import { validateIngestionPayload } from "../../../src/services/ingestion.service.js";
import type { IngestionPayload } from "../../../src/schemas/ingestion.schemas.js";

function payloadWithObjects(objects: IngestionPayload["objects"]): IngestionPayload {
  return { version: "1.0", mode: "create", objects };
}

describe("validateIngestionPayload", () => {
  it("flags duplicate client_ref", () => {
    const result = validateIngestionPayload(
      payloadWithObjects([
        {
          type: "product",
          client_ref: "dup",
          data: {
            sku: "A1",
            name: "A",
            productType: "service",
            salePriceCents: 0,
            costPriceCents: 0,
          },
        },
        {
          type: "product",
          client_ref: "dup",
          data: {
            sku: "B1",
            name: "B",
            productType: "service",
            salePriceCents: 0,
            costPriceCents: 0,
          },
        },
      ]),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("duplicado"))).toBe(true);
  });

  it("passes when client_refs are unique", () => {
    const result = validateIngestionPayload(
      payloadWithObjects([
        {
          type: "product",
          client_ref: "a",
          data: {
            sku: "A1",
            name: "A",
            productType: "service",
            salePriceCents: 0,
            costPriceCents: 0,
          },
        },
        {
          type: "product",
          client_ref: "b",
          data: {
            sku: "B1",
            name: "B",
            productType: "service",
            salePriceCents: 0,
            costPriceCents: 0,
          },
        },
      ]),
    );
    expect(result.valid).toBe(true);
    expect(result.summary.total).toBe(2);
    expect(result.summary.byType.product).toBe(2);
  });

  it("flags product categoryRef pointing to wrong type", () => {
    const result = validateIngestionPayload(
      payloadWithObjects([
        {
          type: "supplier",
          client_ref: "only_supplier",
          data: {
            type: "company",
            legalName: "ACME",
            documentType: "cnpj",
          },
        },
        {
          type: "product",
          data: {
            sku: "P1",
            name: "P",
            productType: "finished_product",
            salePriceCents: 100,
            costPriceCents: 50,
            categoryRef: "only_supplier",
          },
        },
      ]),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "data.categoryRef")).toBe(true);
  });

  it("passes when product categoryRef targets category", () => {
    const result = validateIngestionPayload(
      payloadWithObjects([
        {
          type: "category",
          client_ref: "cat1",
          data: { name: "Cat", slug: "cat" },
        },
        {
          type: "product",
          data: {
            sku: "P1",
            name: "P",
            productType: "finished_product",
            salePriceCents: 100,
            costPriceCents: 50,
            categoryRef: "cat1",
          },
        },
      ]),
    );
    expect(result.valid).toBe(true);
  });
});
