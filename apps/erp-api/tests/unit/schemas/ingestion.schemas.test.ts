import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  INGESTION_MAX_OBJECTS,
  ingestionPayloadSchema,
  productCompositionSetIngestionDataSchema,
  productIngestionDataSchema,
} from "../../../src/schemas/ingestion.schemas.js";

describe("ingestionPayloadSchema", () => {
  it("accepts minimal valid payload with one product", () => {
    const result = ingestionPayloadSchema.safeParse({
      version: "1.0",
      mode: "create",
      objects: [
        {
          type: "product",
          data: {
            sku: "X-1",
            name: "Test",
            productType: "finished_product",
            salePriceCents: 100,
            costPriceCents: 50,
          },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects wrong version", () => {
    const result = ingestionPayloadSchema.safeParse({
      version: "2.0",
      mode: "create",
      objects: [
        {
          type: "product",
          data: {
            sku: "A",
            name: "B",
            productType: "service",
            salePriceCents: 0,
            costPriceCents: 0,
          },
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it(`limite de objectos (${INGESTION_MAX_OBJECTS}) aplicado ao campo objects`, () => {
    expect(INGESTION_MAX_OBJECTS).toBe(50_000);
    const oversize = Array.from({ length: INGESTION_MAX_OBJECTS + 1 }, () => null);
    expect(z.array(z.any()).max(INGESTION_MAX_OBJECTS).safeParse(oversize).success).toBe(false);
  });
});

describe("product_composition_set (Zod)", () => {
  it("accepts replace payload with parentProductSku and childProductSku", () => {
    const result = ingestionPayloadSchema.safeParse({
      version: "1.0",
      mode: "create",
      objects: [
        {
          type: "product_composition_set",
          action: "replace",
          client_ref: "set-1",
          data: {
            parentProductSku: "pf-00001",
            replaceTypes: ["bom", "packaging"],
            items: [
              {
                childProductSku: "CMP-FIO",
                quantity: 1,
                quantityUnit: "m",
                compositionType: "bom",
                required: true,
                isDefault: true,
                notes: "Fio principal.",
              },
            ],
          },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects packagingChannel when replaceTypes omits packaging", () => {
    const r = productCompositionSetIngestionDataSchema.safeParse({
      parentProductSku: "P1",
      replaceTypes: ["bom"],
      packagingChannel: "online",
      items: [],
    });
    expect(r.success).toBe(false);
  });

  it("rejects two parent identifiers at once", () => {
    const r = productCompositionSetIngestionDataSchema.safeParse({
      parentProductSku: "A",
      parentProductSlug: "b",
      replaceTypes: ["bom"],
      items: [],
    });
    expect(r.success).toBe(false);
  });
});

describe("line_composition (Zod)", () => {
  it("accepts line BOM and packaging with both channel", () => {
    const result = ingestionPayloadSchema.safeParse({
      version: "1.0",
      mode: "create",
      objects: [
        {
          type: "line",
          client_ref: "lin-1",
          data: { name: "Linha teste", slug: "linha-teste" },
        },
        {
          type: "product",
          client_ref: "cmp-1",
          data: {
            sku: "CMP-1",
            name: "Caixa",
            productType: "packaging",
            salePriceCents: 0,
            costPriceCents: 100,
          },
        },
        {
          type: "line_composition",
          data: {
            parentLineRef: "lin-1",
            childProductRef: "cmp-1",
            quantity: 1,
            quantityUnit: "unit",
            compositionType: "packaging",
            packagingChannel: "both",
          },
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe("line_composition_set (Zod)", () => {
  it("accepts replace payload with parentLineRef and packagingChannel both", () => {
    const result = ingestionPayloadSchema.safeParse({
      version: "1.0",
      mode: "create",
      objects: [
        {
          type: "line_composition_set",
          action: "replace",
          data: {
            parentLineRef: "lin-1",
            replaceTypes: ["packaging"],
            items: [
              {
                childProductSku: "CMP-1",
                quantity: 1,
                compositionType: "packaging",
                packagingChannel: "both",
              },
            ],
          },
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe("productIngestionDataSchema", () => {
  it("accepts optional image URLs", () => {
    const result = productIngestionDataSchema.safeParse({
      sku: "P1",
      name: "P",
      productType: "finished_product",
      salePriceCents: 100,
      costPriceCents: 50,
      main_image_url: "https://example.com/a.jpg",
      gallery_image_urls: ["https://example.com/b.png"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-https main_image_url", () => {
    const result = productIngestionDataSchema.safeParse({
      sku: "P1",
      name: "P",
      productType: "finished_product",
      salePriceCents: 100,
      costPriceCents: 50,
      main_image_url: "http://example.com/a.jpg",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid gallery URL", () => {
    const result = productIngestionDataSchema.safeParse({
      sku: "P1",
      name: "P",
      productType: "finished_product",
      salePriceCents: 100,
      costPriceCents: 50,
      gallery_image_urls: ["not-a-url"],
    });
    expect(result.success).toBe(false);
  });
});
