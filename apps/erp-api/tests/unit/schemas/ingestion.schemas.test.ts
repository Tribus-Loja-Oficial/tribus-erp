import { describe, it, expect } from "vitest";
import {
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
          data: { sku: "A", name: "B", productType: "service" },
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 100 objects", () => {
    const objects = Array.from({ length: 101 }, (_, i) => ({
      type: "product" as const,
      data: { sku: `S${i}`, name: `N${i}`, productType: "service" as const },
    }));
    const result = ingestionPayloadSchema.safeParse({
      version: "1.0",
      mode: "create",
      objects,
    });
    expect(result.success).toBe(false);
  });
});

describe("productIngestionDataSchema", () => {
  it("accepts optional image URLs", () => {
    const result = productIngestionDataSchema.safeParse({
      sku: "P1",
      name: "P",
      productType: "finished_product",
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
      main_image_url: "http://example.com/a.jpg",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid gallery URL", () => {
    const result = productIngestionDataSchema.safeParse({
      sku: "P1",
      name: "P",
      productType: "finished_product",
      gallery_image_urls: ["not-a-url"],
    });
    expect(result.success).toBe(false);
  });
});
