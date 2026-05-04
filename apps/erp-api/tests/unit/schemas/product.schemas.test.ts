import { describe, it, expect } from "vitest";
import {
  createProductSchema,
  updateProductSchema,
  listProductsSchema,
  createVariantSchema,
  createProductCompositionSchema,
  permanentDeleteProductSchema,
} from "../../../src/schemas/product.schemas.js";

describe("createProductSchema", () => {
  it("accepts valid product", () => {
    const result = createProductSchema.safeParse({
      sku: "PROD-001",
      name: "Pulseira Gold",
      productType: "finished_product",
      salePriceCents: 9900,
      costPriceCents: 3000,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing sku", () => {
    const result = createProductSchema.safeParse({
      name: "Test",
      productType: "finished_product",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty sku", () => {
    const result = createProductSchema.safeParse({
      sku: "",
      name: "Test",
      productType: "finished_product",
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative price", () => {
    const result = createProductSchema.safeParse({
      sku: "X",
      name: "Y",
      productType: "finished_product",
      salePriceCents: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing productType", () => {
    const result = createProductSchema.safeParse({ sku: "X", name: "Y" });
    expect(result.success).toBe(false);
  });

  it("defaults status to draft", () => {
    const result = createProductSchema.safeParse({
      sku: "X",
      name: "Y",
      productType: "packaging",
    });
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

  it("defaults page to 1 and composeCatalog to false", () => {
    const result = listProductsSchema.safeParse({});
    if (!result.success) throw new Error();
    expect(result.data.page).toBe(1);
    expect(result.data.composeCatalog).toBe(false);
  });

  it("rejects page 0", () => {
    const result = listProductsSchema.safeParse({ page: "0" });
    expect(result.success).toBe(false);
  });

  it("accepts limit 200 for operational listings", () => {
    const result = listProductsSchema.safeParse({ limit: "200" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.limit).toBe(200);
  });

  it("rejects limit over 200", () => {
    const result = listProductsSchema.safeParse({ limit: "201" });
    expect(result.success).toBe(false);
  });

  it("accepts productType filter", () => {
    const result = listProductsSchema.safeParse({ productType: "packaging" });
    expect(result.success).toBe(true);
  });

  it("parses composeCatalog from query string", () => {
    const result = listProductsSchema.safeParse({ composeCatalog: "1" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.composeCatalog).toBe(true);
  });

  it("accepts sortField externalRef", () => {
    const result = listProductsSchema.safeParse({
      sortField: "externalRef",
      sortDir: "asc",
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.sortField).toBe("externalRef");
  });

  it("accepts productKind filter", () => {
    const result = listProductsSchema.safeParse({ productKind: "variable" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.productKind).toBe("variable");
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

describe("createProductCompositionSchema", () => {
  it("accepts valid row", () => {
    const result = createProductCompositionSchema.safeParse({
      childProductId: "child-1",
      quantity: 2,
      compositionType: "bom",
    });
    expect(result.success).toBe(true);
  });

  it("rejects zero quantity", () => {
    const result = createProductCompositionSchema.safeParse({
      childProductId: "child-1",
      quantity: 0,
      compositionType: "bom",
    });
    expect(result.success).toBe(false);
  });

  it("requires packaging channel for packaging type", () => {
    const result = createProductCompositionSchema.safeParse({
      childProductId: "child-1",
      quantity: 1,
      compositionType: "packaging",
    });
    expect(result.success).toBe(false);
  });

  it("accepts packaging with channel", () => {
    const result = createProductCompositionSchema.safeParse({
      childProductId: "child-1",
      quantity: 1,
      compositionType: "packaging",
      packagingChannel: "online",
    });
    expect(result.success).toBe(true);
  });
});

describe("permanentDeleteProductSchema", () => {
  it("accepts confirmSku", () => {
    const result = permanentDeleteProductSchema.safeParse({ confirmSku: "SKU-001" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.confirmSku).toBe("SKU-001");
  });

  it("rejects empty confirmSku", () => {
    const result = permanentDeleteProductSchema.safeParse({ confirmSku: "" });
    expect(result.success).toBe(false);
  });
});
