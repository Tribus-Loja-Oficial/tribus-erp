import {
  aggregatePurchaseRowsByReceipt,
  computeAverageCostFromLastPurchases,
  type PurchaseReceiptItemCostRow,
} from "./product-cost.js";

export type { PurchaseReceiptItemCostRow, PurchaseReceiptCostAggregate } from "./product-cost.js";
export {
  aggregatePurchaseRowsByReceipt,
  computeAverageCostFromLastPurchases,
} from "./product-cost.js";

/** Recalcula custo médio a partir de linhas de recebimento (já carregadas do repositório). */
export function averageCostFromReceiptItemRows(
  rows: PurchaseReceiptItemCostRow[],
  maxReceipts = 2,
) {
  const aggregates = aggregatePurchaseRowsByReceipt(rows);
  return computeAverageCostFromLastPurchases(aggregates, maxReceipts);
}
