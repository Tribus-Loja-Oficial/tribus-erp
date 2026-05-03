import type { AppDb } from "../db/client.js";
import { createProductCompositionRepository } from "../repositories/product-composition.repository.js";
import { createProductRepository } from "../repositories/product.repository.js";
import { createProductProductionProfileRepository } from "../repositories/product-production-profile.repository.js";
import {
  buildProductCostBreakdownCents,
  calculateLaborCostCents,
  type CompositionRowForCost,
  type ProductCostBreakdownCents,
} from "../domain/product-cost.js";

export function createProductCostService(db: AppDb) {
  const compositionsRepo = createProductCompositionRepository(db);
  const productsRepo = createProductRepository(db);
  const profileRepo = createProductProductionProfileRepository(db);

  return {
    async getBreakdownForParentProduct(
      parentProductId: string,
    ): Promise<ProductCostBreakdownCents> {
      const compositions = await compositionsRepo.findActiveByParentId(parentProductId);
      const childIds = [...new Set(compositions.map((c) => c.childProductId))];
      const children = await productsRepo.findByIds(childIds);
      const childMap = new Map(children.map((c) => [c.id, c]));
      const profile = await profileRepo.findByProductId(parentProductId);

      const rows: CompositionRowForCost[] = [];
      for (const c of compositions) {
        const child = childMap.get(c.childProductId);
        if (!child) continue;
        rows.push({
          compositionType: c.compositionType,
          quantity: c.quantity,
          packagingChannel: c.packagingChannel ?? null,
          child,
        });
      }

      const labor = calculateLaborCostCents(
        profile?.averageProductionTimeMinutes,
        profile?.laborCostPerHourCents,
      );

      return buildProductCostBreakdownCents(rows, labor);
    },
  };
}
