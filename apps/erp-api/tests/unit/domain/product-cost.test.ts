import { describe, it, expect } from "vitest";
import {
  buildProductCostBreakdownCents,
  calculateEstimatedProductCost,
  calculateLaborCostCents,
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

describe("buildProductCostBreakdownCents", () => {
  const childA = {
    costPriceCents: 100,
    costPerConsumptionUnitCents: 4.5,
    productType: "raw_material",
  } as Product;

  const childB = {
    costPriceCents: 50,
    costPerConsumptionUnitCents: null,
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
  it("uses cost per consumption when set", () => {
    const child = {
      costPriceCents: 999,
      costPerConsumptionUnitCents: 4.5,
    } as Product;
    const line = lineCostCentsFromComposition(10, child);
    expect(line.unitCostCents).toBe(4.5);
    expect(line.totalCostCents).toBe(45);
  });
});
