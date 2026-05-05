import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  INGESTION_MAX_OBJECTS,
  ingestionPayloadSchema,
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
