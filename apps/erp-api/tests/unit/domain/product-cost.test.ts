import { describe, it, expect } from "vitest";
import {
  aggregatePurchaseRowsByReceipt,
  buildProductCostBreakdownCents,
  calculateEstimatedProductCost,
  calculateLaborCostCents,
  childCostUnitBasisForProduct,
  childUnitCostCentsForCompositionLine,
  computeAverageCostFromLastPurchases,
  lineCostCentsFromComposition,
} from "../../../src/domain/product-cost.js";
import type { Product } from "../../../src/db/schema/index.js";

describe("calculateEstimatedProductCost", () => {
  it("sums base and typed composition lines", () => {
    const out = calculateEstimatedProductCost(1000, [
      { compositionType: "bom", quantity: 2, childCostPriceCents: 500 },
      { compositionType: "packaging", quantity: 1, childCostPriceCents: 200 },
      { compositionType: "accessory", quantity: 1, childCostPriceCents: 50 },
    ]);
    expect(out.baseCostCents).toBe(1000);
    expect(out.bomCostCents).toBe(1000);
    expect(out.packagingCostCents).toBe(200);
    expect(out.kitCostCents).toBe(0);
    expect(out.bundleCostCents).toBe(0);
    expect(out.otherCompositionCostCents).toBe(50);
    expect(out.totalEstimatedCostCents).toBe(2250);
  });

  it("splits kit and bundle from other composition cost", () => {
    const out = calculateEstimatedProductCost(0, [
      { compositionType: "kit", quantity: 1, childCostPriceCents: 300 },
      { compositionType: "bundle", quantity: 2, childCostPriceCents: 100 },
      { compositionType: "included", quantity: 1, childCostPriceCents: 25 },
    ]);
    expect(out.kitCostCents).toBe(300);
    expect(out.bundleCostCents).toBe(200);
    expect(out.otherCompositionCostCents).toBe(25);
    expect(out.totalEstimatedCostCents).toBe(525);
  });
});

describe("calculateLaborCostCents", () => {
  it("computes 23 min at 1500 cents/hour as 575 cents", () => {
    expect(calculateLaborCostCents(23, 1500)).toBe(575);
  });

  it("returns 0 when inputs missing", () => {
    expect(calculateLaborCostCents(null, 1500)).toBe(0);
    expect(calculateLaborCostCents(10, null)).toBe(0);
  });
});

describe("computeAverageCostFromLastPurchases", () => {
  it("returns null with no receipts", () => {
    expect(computeAverageCostFromLastPurchases([])).toBeNull();
  });

  it("uses single receipt unit cost", () => {
    const out = computeAverageCostFromLastPurchases([
      {
        receiptId: "r1",
        receivedAt: "2025-01-02T00:00:00.000Z",
        totalCostCents: 1000,
        stockQuantity: 100,
        stockUnit: "g",
      },
    ]);
    expect(out).toEqual({
      averageCostDecimal: 10,
      averageCostUnit: "g",
      receiptCount: 1,
    });
  });

  it("weights two receipts by quantity (100g@10 + 1000g@80)", () => {
    const out = computeAverageCostFromLastPurchases([
      {
        receiptId: "r2",
        receivedAt: "2025-02-01T00:00:00.000Z",
        totalCostCents: 8000,
        stockQuantity: 1000,
        stockUnit: "g",
      },
      {
        receiptId: "r1",
        receivedAt: "2025-01-01T00:00:00.000Z",
        totalCostCents: 1000,
        stockQuantity: 100,
        stockUnit: "g",
      },
    ]);
    expect(out?.averageCostDecimal).toBeCloseTo(9000 / 1100, 8);
    expect(out?.averageCostUnit).toBe("g");
    expect(out?.receiptCount).toBe(2);
  });

  it("ignores receipts beyond the last two", () => {
    const out = computeAverageCostFromLastPurchases(
      [
        {
          receiptId: "r3",
          receivedAt: "2025-03-01T00:00:00.000Z",
          totalCostCents: 500,
          stockQuantity: 50,
          stockUnit: "g",
        },
        {
          receiptId: "r2",
          receivedAt: "2025-02-01T00:00:00.000Z",
          totalCostCents: 200,
          stockQuantity: 20,
          stockUnit: "g",
        },
        {
          receiptId: "r1",
          receivedAt: "2025-01-01T00:00:00.000Z",
          totalCostCents: 9999,
          stockQuantity: 999,
          stockUnit: "g",
        },
      ],
      2,
    );
    expect(out?.receiptCount).toBe(2);
    expect(out?.averageCostDecimal).toBeCloseTo(700 / 70, 8);
  });
});

describe("aggregatePurchaseRowsByReceipt", () => {
  it("sums multiple lines on the same receipt", () => {
    const agg = aggregatePurchaseRowsByReceipt([
      {
        receiptId: "r1",
        receivedAt: "2025-01-01T00:00:00.000Z",
        totalCostCents: 300,
        stockQuantity: 30,
        stockUnit: "cm",
      },
      {
        receiptId: "r1",
        receivedAt: "2025-01-01T00:00:00.000Z",
        totalCostCents: 200,
        stockQuantity: 20,
        stockUnit: "cm",
      },
    ]);
    expect(agg).toHaveLength(1);
    expect(agg[0]?.totalCostCents).toBe(500);
    expect(agg[0]?.stockQuantity).toBe(50);
  });
});

describe("childUnitCostCentsForCompositionLine", () => {
  it("prefers averageCostDecimal over costPriceCents", () => {
    const child = {
      averageCostDecimal: 4.5,
      costPriceCents: 999,
      costPerConsumptionUnitCents: 1,
    } as Product;
    expect(childUnitCostCentsForCompositionLine(child)).toBe(4.5);
    expect(childCostUnitBasisForProduct(child)).toBe("average");
  });

  it("falls back to costPriceCents when no average", () => {
    const child = {
      averageCostDecimal: null,
      costPriceCents: 120,
      costPerConsumptionUnitCents: 4.5,
    } as Product;
    expect(childUnitCostCentsForCompositionLine(child)).toBe(120);
    expect(childCostUnitBasisForProduct(child)).toBe("legacy_cost_price");
  });
});

describe("buildProductCostBreakdownCents", () => {
  const childA = {
    averageCostDecimal: 4.5,
    costPriceCents: 100,
    productType: "raw_material",
  } as Product;

  const childB = {
    averageCostDecimal: null,
    costPriceCents: 50,
    productType: "packaging",
  } as Product;

  it("splits materials, packaging channels and labor", () => {
    const out = buildProductCostBreakdownCents(
      [
        { compositionType: "bom", quantity: 82, packagingChannel: null, child: childA },
        {
          compositionType: "packaging",
          quantity: 1,
          packagingChannel: "online",
          child: childB,
        },
        {
          compositionType: "packaging",
          quantity: 2,
          packagingChannel: "presential",
          child: childB,
        },
      ],
      575,
    );
    expect(out.materialCostCents).toBe(Math.round(82 * 4.5));
    expect(out.packagingOnlineCostCents).toBe(50);
    expect(out.packagingPresentialCostCents).toBe(100);
    expect(out.laborCostCents).toBe(575);
    expect(out.onlineTotalCostCents).toBe(out.materialCostCents + 50 + 575);
    expect(out.presentialTotalCostCents).toBe(out.materialCostCents + 100 + 575);
  });
});

describe("lineCostCentsFromComposition", () => {
  it("uses average cost when set", () => {
    const child = {
      averageCostDecimal: 4.5,
      costPriceCents: 999,
    } as Product;
    const line = lineCostCentsFromComposition(10, child);
    expect(line.unitCostCents).toBe(4.5);
    expect(line.totalCostCents).toBe(45);
  });
});
