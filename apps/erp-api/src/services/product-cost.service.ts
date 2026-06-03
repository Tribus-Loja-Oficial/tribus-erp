import type { AppDb } from "../db/client.js";
import { createProductCompositionRepository } from "../repositories/product-composition.repository.js";
import { createLineCompositionRepository } from "../repositories/line-composition.repository.js";
import { createProductRepository } from "../repositories/product.repository.js";
import { createProductProductionProfileRepository } from "../repositories/product-production-profile.repository.js";
import {
  buildProductCostBreakdownCents,
  buildSnapshotComponentLines,
  calculateLaborCostCents,
  type CompositionRowForCost,
  type ProductCostBreakdownCents,
  type ProductCostSnapshotComponentLine,
} from "../domain/product-cost.js";
import { mergeEffectiveComposition } from "../domain/composition-merge.js";

export function createProductCostService(db: AppDb) {
  const compositionsRepo = createProductCompositionRepository(db);
  const lineCompositionsRepo = createLineCompositionRepository(db);
  const productsRepo = createProductRepository(db);
  const profileRepo = createProductProductionProfileRepository(db);

  return {
    async getBreakdownAndSnapshotLines(parentProductId: string): Promise<{
      breakdown: ProductCostBreakdownCents;
      componentLines: ProductCostSnapshotComponentLine[];
    }> {
      const parent = await productsRepo.findById(parentProductId);
      if (!parent) {
        return {
          breakdown: buildProductCostBreakdownCents([], 0),
          componentLines: [],
        };
      }

      const productRows = await compositionsRepo.findActiveByParentId(parentProductId);
      const lineRows = parent.lineId
        ? await lineCompositionsRepo.findActiveByParentLineId(parent.lineId)
        : [];

      const merged = mergeEffectiveComposition(lineRows, productRows);

      const childIds = [...new Set(merged.map((c) => c.childProductId))];
      const children = await productsRepo.findByIds(childIds);
      const childMap = new Map(children.map((c) => [c.id, c]));
      const profile = await profileRepo.findByProductId(parentProductId);

      const rows: CompositionRowForCost[] = [];
      const snapshotRows: Array<{
        id: string;
        compositionType: string;
        quantity: number;
        quantityUnit: string | null;
        packagingChannel: string | null;
        childProductId: string;
        child: (typeof children)[number];
        scope: "line" | "product";
        sourceCompositionId: string;
      }> = [];

      for (const c of merged) {
        const child = childMap.get(c.childProductId);
        if (!child) continue;
        rows.push({
          compositionType: c.compositionType,
          quantity: c.quantity,
          packagingChannel: c.packagingChannel ?? null,
          child,
        });
        snapshotRows.push({
          id: c.id,
          compositionType: c.compositionType,
          quantity: c.quantity,
          quantityUnit: c.quantityUnit ?? null,
          packagingChannel: c.packagingChannel ?? null,
          childProductId: c.childProductId,
          child,
          scope: c.scope,
          sourceCompositionId: c.sourceCompositionId,
        });
      }

      const labor = calculateLaborCostCents(
        profile?.averageProductionTimeMinutes,
        profile?.laborCostPerHourCents,
      );

      return {
        breakdown: buildProductCostBreakdownCents(rows, labor),
        componentLines: buildSnapshotComponentLines(snapshotRows),
      };
    },

    async getBreakdownForParentProduct(
      parentProductId: string,
    ): Promise<ProductCostBreakdownCents> {
      const { breakdown } = await this.getBreakdownAndSnapshotLines(parentProductId);
      return breakdown;
    },
  };
}
