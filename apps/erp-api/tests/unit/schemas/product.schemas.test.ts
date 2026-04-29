import { describe, it, expect } from "vitest";
import {
  createProductSchema,
  updateProductSchema,
  listProductsSchema,
  createVariantSchema,
} from "../../../src/schemas/product.schemas.js";

describe("createProductSchema", () => {
  it("accepts valid product", () => {
    const result = createProductSchema.safeParse({
      sku: "PROD-001",
      name: "Pulseira Gold",
      productType: "simple",
      salePriceCents: 9900,
      costPriceCents: 3000,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing sku", () => {
    const result = createProductSchema.safeParse({ name: "Test" });
    expect(result.success).toBe(false);
  });

  it("rejects empty sku", () => {
    const result = createProductSchema.safeParse({ sku: "", name: "Test" });
    expect(result.success).toBe(false);
  });

  it("rejects negative price", () => {
    const result = createProductSchema.safeParse({
      sku: "X",
      name: "Y",
      salePriceCents: -1,
    });
    expect(result.success).toBe(false);
  });

  it("defaults productType to simple", () => {
    const result = createProductSchema.safeParse({ sku: "X", name: "Y" });
    if (!result.success) throw new Error();
    expect(result.data.productType).toBe("simple");
  });

  it("defaults status to draft", () => {
    const result = createProductSchema.safeParse({ sku: "X", name: "Y" });
    if (!result.success) throw new Error();
    expect(result.data.status).toBe("draft");
  });
});

describe("updateProductSchema", () => {
  it("allows partial updates", () => {
    const result = updateProductSchema.safeParse({ name: "New Name" });
    expect(result.success).toBe(true);
  });

  it("accepts empty object", () => {
    const result = updateProductSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe("listProductsSchema", () => {
  it("coerces string page to number", () => {
    const result = listProductsSchema.safeParse({ page: "2", limit: "10" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.page).toBe(2);
    expect(result.data.limit).toBe(10);
  });

  it("defaults page to 1", () => {
    const result = listProductsSchema.safeParse({});
    if (!result.success) throw new Error();
    expect(result.data.page).toBe(1);
  });

  it("rejects page 0", () => {
    const result = listProductsSchema.safeParse({ page: "0" });
    expect(result.success).toBe(false);
  });

  it("rejects limit over 100", () => {
    const result = listProductsSchema.safeParse({ limit: "200" });
    expect(result.success).toBe(false);
  });
});

describe("createVariantSchema", () => {
  it("accepts valid variant", () => {
    const result = createVariantSchema.safeParse({
      productId: "prod-1",
      sku: "VAR-001",
      name: "P",
      salePriceCents: 5000,
    });
    expect(result.success).toBe(true);
  });
});
