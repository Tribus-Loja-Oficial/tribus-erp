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

  it("rejects product_variant when parent product is simple in same payload", () => {
    const result = validateIngestionPayload(
      payloadWithObjects([
        {
          type: "product",
          client_ref: "parent",
          data: {
            sku: "P-SKU",
            name: "Parent",
            productType: "finished_product",
            salePriceCents: 100,
            costPriceCents: 50,
            productKind: "simple",
          },
        },
        {
          type: "product_variant",
          client_ref: "v1",
          data: {
            productRef: "parent",
            sku: "V-SKU",
            attributes: { Cor: "A" },
          },
        },
      ]),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "data.productRef")).toBe(true);
  });

  it("requires variantId or variantRef on inventory_movement for variable productRef in batch", () => {
    const result = validateIngestionPayload(
      payloadWithObjects([
        {
          type: "stock_location",
          client_ref: "loc",
          data: { name: "Main", type: "main" },
        },
        {
          type: "product",
          client_ref: "varp",
          data: {
            sku: "VAR-P",
            name: "Variable",
            productType: "finished_product",
            salePriceCents: 100,
            costPriceCents: 50,
            productKind: "variable",
          },
        },
        {
          type: "inventory_movement",
          data: {
            productRef: "varp",
            locationRef: "loc",
            type: "purchase",
            quantity: 1,
          },
        },
      ]),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "data.variantId")).toBe(true);
  });

  it("passes inventory_movement for variable product when variantRef targets product_variant", () => {
    const result = validateIngestionPayload(
      payloadWithObjects([
        {
          type: "stock_location",
          client_ref: "loc",
          data: { name: "Main", type: "main" },
        },
        {
          type: "product",
          client_ref: "varp",
          data: {
            sku: "VAR-P",
            name: "Variable",
            productType: "finished_product",
            salePriceCents: 100,
            costPriceCents: 50,
            productKind: "variable",
          },
        },
        {
          type: "product_variant",
          client_ref: "v1",
          data: {
            productRef: "varp",
            sku: "V-SKU",
            attributes: { Cor: "A" },
          },
        },
        {
          type: "inventory_movement",
          data: {
            productRef: "varp",
            locationRef: "loc",
            variantRef: "v1",
            type: "purchase",
            quantity: 1,
          },
        },
      ]),
    );
    expect(result.valid).toBe(true);
  });

  it("requires variant on order line when productRef is variable in batch", () => {
    const result = validateIngestionPayload(
      payloadWithObjects([
        {
          type: "customer",
          client_ref: "c1",
          data: {
            type: "individual",
            legalName: "João",
            documentType: "cpf",
            documentNumber: "52998224725",
          },
        },
        {
          type: "product",
          client_ref: "varp",
          data: {
            sku: "VAR-P",
            name: "Variable",
            productType: "finished_product",
            salePriceCents: 100,
            costPriceCents: 50,
            productKind: "variable",
          },
        },
        {
          type: "order",
          data: {
            customerRef: "c1",
            items: [
              {
                productRef: "varp",
                sku: "LINE",
                name: "Line",
                quantity: 1,
                unitPriceCents: 100,
              },
            ],
          },
        },
      ]),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "data.items[0].variantId")).toBe(true);
  });

  it("flags duplicate natural keys in product_composition_set items", () => {
    const result = validateIngestionPayload(
      payloadWithObjects([
        {
          type: "product_composition_set",
          action: "replace",
          data: {
            parentProductSku: "PARENT",
            replaceTypes: ["bom"],
            items: [
              {
                childProductSku: "CHILD",
                quantity: 1,
                compositionType: "bom",
                required: true,
                isDefault: true,
              },
              {
                childProductSku: "CHILD",
                quantity: 2,
                compositionType: "bom",
                required: true,
                isDefault: true,
              },
            ],
          },
        },
      ]),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field?.includes("items"))).toBe(true);
  });
});
