import type { Product } from "../db/schema/index.js";

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

export type ProductCostBreakdownCents = {
  materialCostCents: number;
  packagingOnlineCostCents: number;
  packagingPresentialCostCents: number;
  laborCostCents: number;
  onlineTotalCostCents: number;
  presentialTotalCostCents: number;
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

/** Custo unitário do componente na linha de composição (cents por unidade de quantidade informada na composição). */
export function childUnitCostCentsForCompositionLine(child: Product): number {
  const averageCost = child.averageCostDecimal;
  if (averageCost != null && Number.isFinite(averageCost) && averageCost >= 0) {
    return averageCost;
  }
  const perConsumption = child.costPerConsumptionUnitCents;
  if (perConsumption != null && Number.isFinite(perConsumption) && perConsumption >= 0) {
    return perConsumption;
  }
  return Math.max(0, child.costPriceCents);
}

export function lineCostCentsFromComposition(
  quantity: number,
  child: Product,
): { unitCostCents: number; totalCostCents: number } {
  const unitCostCents = childUnitCostCentsForCompositionLine(child);
  const totalCostCents = Math.round(quantity * unitCostCents);
  return { unitCostCents, totalCostCents };
}

export function calculateLaborCostCents(
  averageProductionTimeMinutes: number | null | undefined,
  laborCostPerHourCents: number | null | undefined,
): number {
  if (
    averageProductionTimeMinutes == null ||
    laborCostPerHourCents == null ||
    averageProductionTimeMinutes <= 0 ||
    laborCostPerHourCents <= 0
  ) {
    return 0;
  }
  return Math.round((averageProductionTimeMinutes / 60) * laborCostPerHourCents);
}

export type CompositionRowForCost = {
  compositionType: string;
  quantity: number;
  packagingChannel: string | null;
  child: Product;
};

export function buildProductCostBreakdownCents(
  compositions: CompositionRowForCost[],
  laborCostCents: number,
): ProductCostBreakdownCents {
  let materialCostCents = 0;
  let packagingOnlineCostCents = 0;
  let packagingPresentialCostCents = 0;

  for (const row of compositions) {
    const { totalCostCents } = lineCostCentsFromComposition(row.quantity, row.child);
    if (row.compositionType === "bom") {
      materialCostCents += totalCostCents;
    } else if (row.compositionType === "packaging") {
      if (row.packagingChannel === "online") packagingOnlineCostCents += totalCostCents;
      else if (row.packagingChannel === "presential")
        packagingPresentialCostCents += totalCostCents;
    }
  }

  const labor = Math.max(0, laborCostCents);
  return {
    materialCostCents,
    packagingOnlineCostCents,
    packagingPresentialCostCents,
    laborCostCents: labor,
    onlineTotalCostCents: materialCostCents + packagingOnlineCostCents + labor,
    presentialTotalCostCents: materialCostCents + packagingPresentialCostCents + labor,
  };
}

/** Deriva custo por unidade de consumo a partir da compra (acquisition / purchaseQuantity), em cents. */
export function deriveCostPerConsumptionUnitCents(product: {
  acquisitionCostCents: number | null;
  purchaseQuantity: number | null;
}): number | null {
  const acq = product.acquisitionCostCents;
  const pq = product.purchaseQuantity;
  if (acq == null || pq == null || pq <= 0 || acq < 0) return null;
  return acq / pq;
}

/** Qual campo do cadastro do componente alimenta o custo unitário na linha de composição. */
export type ChildCostUnitBasis = "average" | "consumption_unit" | "legacy_cost_price";

export function childCostUnitBasisForProduct(child: Product): ChildCostUnitBasis {
  const averageCost = child.averageCostDecimal;
  if (averageCost != null && Number.isFinite(averageCost) && averageCost >= 0) {
    return "average";
  }
  const perConsumption = child.costPerConsumptionUnitCents;
  if (perConsumption != null && Number.isFinite(perConsumption) && perConsumption >= 0) {
    return "consumption_unit";
  }
  return "legacy_cost_price";
}

/** Risco de custo “só planilha” — sem média de compra consolidada. */
export function compositionLineUsesLegacyCostRisk(child: Product): boolean {
  const basis = childCostUnitBasisForProduct(child);
  if (basis === "legacy_cost_price") return true;
  return child.costSource === "legacy_ingestion";
}

/** Linhas persistidas em `product_cost_snapshots.component_costs_json`. */
export type ProductCostSnapshotComponentLine = {
  compositionId: string;
  childProductId: string;
  childSku: string | null;
  childName: string | null;
  childProductType: string | null;
  compositionType: string;
  quantity: number;
  quantityUnit: string | null;
  packagingChannel: string | null;
  unitCostBasis: ChildCostUnitBasis;
  /** Mesma convenção numérica que `childUnitCostCentsForCompositionLine`. */
  unitCost: number;
  lineTotalCents: number;
  costSource: string;
  costUpdatedAt: string | null;
  lastPurchaseDate: string | null;
  averageCostUnit: string | null;
};

export function buildSnapshotComponentLines(
  rows: Array<{
    id: string;
    compositionType: string;
    quantity: number;
    quantityUnit: string | null;
    packagingChannel: string | null;
    childProductId: string;
    child: Product;
  }>,
): ProductCostSnapshotComponentLine[] {
  return rows.map((row) => {
    const { unitCostCents, totalCostCents } = lineCostCentsFromComposition(row.quantity, row.child);
    return {
      compositionId: row.id,
      childProductId: row.childProductId,
      childSku: row.child.sku,
      childName: row.child.name,
      childProductType: row.child.productType,
      compositionType: row.compositionType,
      quantity: row.quantity,
      quantityUnit: row.quantityUnit,
      packagingChannel: row.packagingChannel,
      unitCostBasis: childCostUnitBasisForProduct(row.child),
      unitCost: unitCostCents,
      lineTotalCents: totalCostCents,
      costSource: row.child.costSource,
      costUpdatedAt: row.child.costUpdatedAt ?? null,
      lastPurchaseDate: row.child.lastPurchaseDate ?? null,
      averageCostUnit: row.child.averageCostUnit ?? null,
    };
  });
}
