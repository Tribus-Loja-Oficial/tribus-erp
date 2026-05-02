import { describe, it, expect } from "vitest";
import { calculateEstimatedProductCost } from "../../../src/domain/product-cost.js";

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
