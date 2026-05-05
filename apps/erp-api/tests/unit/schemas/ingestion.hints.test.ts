import { describe, it, expect } from "vitest";
import { ingestionPayloadSchema } from "../../../src/schemas/ingestion.schemas.js";

const basePayload = {
  version: "1.0" as const,
  mode: "create" as const,
  objects: [] as unknown[],
};

describe("ingestion hints (produto / movimento)", () => {
  it("rejects finished_good with suggestion", () => {
    const result = ingestionPayloadSchema.safeParse({
      ...basePayload,
      objects: [
        {
          type: "product",
          data: {
            sku: "X",
            name: "Y",
            productType: "finished_good",
            salePriceCents: 1,
            costPriceCents: 0,
          },
        },
      ],
    });
    expect(result.success).toBe(false);
    const msg = result.error?.issues.map((i) => i.message).join(" ");
    expect(msg).toMatch(/finished_product/);
  });

  it("rejects WooCommerce publish status with suggestion", () => {
    const result = ingestionPayloadSchema.safeParse({
      ...basePayload,
      objects: [
        {
          type: "product",
          data: {
            sku: "X",
            name: "Y",
            productType: "finished_product",
            status: "publish",
            salePriceCents: 1,
            costPriceCents: 0,
          },
        },
      ],
    });
    expect(result.success).toBe(false);
    const msg = result.error?.issues.map((i) => i.message).join(" ");
    expect(msg).toMatch(/active/);
  });

  it("rejects initial_stock movement type with suggestion", () => {
    const result = ingestionPayloadSchema.safeParse({
      ...basePayload,
      objects: [
        {
          type: "stock_location",
          client_ref: "loc",
          data: { name: "L", type: "main" },
        },
        {
          type: "product",
          client_ref: "p",
          data: {
            sku: "S",
            name: "N",
            productType: "finished_product",
            salePriceCents: 1,
            costPriceCents: 0,
          },
        },
        {
          type: "inventory_movement",
          data: {
            productRef: "p",
            locationRef: "loc",
            type: "initial_stock",
            quantity: 1,
          },
        },
      ],
    });
    expect(result.success).toBe(false);
    const msg = result.error?.issues.map((i) => i.message).join(" ");
    expect(msg).toMatch(/adjustment/);
  });

  it("rejects unknown top-level key on product.data (strict)", () => {
    const result = ingestionPayloadSchema.safeParse({
      ...basePayload,
      objects: [
        {
          type: "product",
          data: {
            sku: "X",
            name: "Y",
            productType: "finished_product",
            salePriceCents: 1,
            costPriceCents: 0,
            regularPriceCents: 999,
          },
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});
