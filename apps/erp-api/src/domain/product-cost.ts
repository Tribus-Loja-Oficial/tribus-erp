export type CompositionCostLine = {
  compositionType: string;
  quantity: number;
  childCostPriceCents: number;
};

export type EstimatedProductCostBreakdown = {
  baseCostCents: number;
  bomCostCents: number;
  packagingCostCents: number;
  kitCostCents: number;
  bundleCostCents: number;
  otherCompositionCostCents: number;
  totalEstimatedCostCents: number;
};

export function calculateEstimatedProductCost(
  baseCostPriceCents: number,
  compositions: CompositionCostLine[],
): EstimatedProductCostBreakdown {
  let bomCostCents = 0;
  let packagingCostCents = 0;
  let kitCostCents = 0;
  let bundleCostCents = 0;
  let otherCompositionCostCents = 0;

  for (const row of compositions) {
    const line = Math.round(row.quantity * row.childCostPriceCents);
    switch (row.compositionType) {
      case "bom":
        bomCostCents += line;
        break;
      case "packaging":
        packagingCostCents += line;
        break;
      case "kit":
        kitCostCents += line;
        break;
      case "bundle":
        bundleCostCents += line;
        break;
      default:
        otherCompositionCostCents += line;
    }
  }

  const baseCostCents = Math.max(0, Math.round(baseCostPriceCents));
  return {
    baseCostCents,
    bomCostCents,
    packagingCostCents,
    kitCostCents,
    bundleCostCents,
    otherCompositionCostCents,
    totalEstimatedCostCents:
      baseCostCents +
      bomCostCents +
      packagingCostCents +
      kitCostCents +
      bundleCostCents +
      otherCompositionCostCents,
  };
}
