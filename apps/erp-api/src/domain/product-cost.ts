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

/** Custo unitário do componente na linha de composição (mesma unidade que averageCostDecimal / quantidade na BOM). */
export function childUnitCostCentsForCompositionLine(child: Product): number {
  const averageCost = child.averageCostDecimal;
  if (averageCost != null && Number.isFinite(averageCost) && averageCost >= 0) {
    return averageCost;
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

/** Agregado por recebimento de compra (uma “compra” = um purchase_receipt). */
export type PurchaseReceiptCostAggregate = {
  receiptId: string;
  receivedAt: string;
  totalCostCents: number;
  stockQuantity: number;
  stockUnit: string;
};

export type PurchaseReceiptItemCostRow = {
  receiptId: string;
  receivedAt: string;
  totalCostCents: number;
  stockQuantity: number;
  stockUnit: string;
};

/** Agrupa linhas de purchase_receipt_items por recebimento. */
export function aggregatePurchaseRowsByReceipt(
  rows: PurchaseReceiptItemCostRow[],
): PurchaseReceiptCostAggregate[] {
  const byReceipt = new Map<string, PurchaseReceiptCostAggregate>();
  for (const row of rows) {
    const existing = byReceipt.get(row.receiptId);
    if (!existing) {
      byReceipt.set(row.receiptId, { ...row });
      continue;
    }
    existing.totalCostCents += row.totalCostCents;
    existing.stockQuantity += row.stockQuantity;
  }
  return [...byReceipt.values()].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
}

/**
 * Custo médio = soma dos custos ÷ soma das quantidades nas N compras (recebimentos) mais recentes.
 * Unidade de referência = unidade de estoque do recebimento mais recente.
 */
export function computeAverageCostFromLastPurchases(
  receiptAggregates: PurchaseReceiptCostAggregate[],
  maxReceipts = 2,
): { averageCostDecimal: number; averageCostUnit: string; receiptCount: number } | null {
  const sorted = [...receiptAggregates].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  const selected = sorted.slice(0, maxReceipts);
  if (selected.length === 0) return null;

  let sumCost = 0;
  let sumQty = 0;
  for (const r of selected) {
    if (r.stockQuantity > 0 && r.totalCostCents >= 0) {
      sumCost += r.totalCostCents;
      sumQty += r.stockQuantity;
    }
  }
  if (sumQty <= 0) return null;

  return {
    averageCostDecimal: sumCost / sumQty,
    averageCostUnit: selected[0]!.stockUnit,
    receiptCount: selected.length,
  };
}

/** Qual campo do cadastro do componente alimenta o custo unitário na linha de composição. */
export type ChildCostUnitBasis = "average" | "legacy_cost_price";

export function childCostUnitBasisForProduct(child: Product): ChildCostUnitBasis {
  const averageCost = child.averageCostDecimal;
  if (averageCost != null && Number.isFinite(averageCost) && averageCost >= 0) {
    return "average";
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
  scope?: "line" | "product";
  sourceCompositionId?: string;
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
    scope?: "line" | "product";
    sourceCompositionId?: string;
  }>,
): ProductCostSnapshotComponentLine[] {
  return rows.map((row) => {
    const { unitCostCents, totalCostCents } = lineCostCentsFromComposition(row.quantity, row.child);
    return {
      compositionId: row.id,
      scope: row.scope,
      sourceCompositionId: row.sourceCompositionId ?? row.id,
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
