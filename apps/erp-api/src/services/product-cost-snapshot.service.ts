import type { AppDb } from "../db/client.js";
import { generateId } from "../utils/id.js";
import { createProductCostService } from "./product-cost.service.js";
import { createProductCostSnapshotRepository } from "../repositories/product-cost-snapshot.repository.js";
import { createProductCompositionRepository } from "../repositories/product-composition.repository.js";

type SnapshotSource =
  | "legacy_ingestion"
  | "manual"
  | "purchase_recalculation"
  | "production_order"
  | "pricing_review";

function parseComponentCostsField(raw: string | null | undefined): unknown[] {
  if (raw == null || String(raw).trim() === "") return [];
  try {
    const p = JSON.parse(raw) as unknown;
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

export function createProductCostSnapshotService(db: AppDb) {
  const costService = createProductCostService(db);
  const snapshotRepo = createProductCostSnapshotRepository(db);
  const compositionRepo = createProductCompositionRepository(db);
  const now = () => new Date().toISOString();

  return {
    async createFromCurrentBom(
      productId: string,
      source: SnapshotSource = "pricing_review",
      metadata?: Record<string, unknown>,
    ) {
      const { breakdown, componentLines } =
        await costService.getBreakdownAndSnapshotLines(productId);
      return snapshotRepo.insert({
        id: generateId(),
        productId,
        snapshotDate: now(),
        source,
        bomVersionId: null,
        materialCostCents: breakdown.materialCostCents,
        packagingCostCents:
          breakdown.packagingOnlineCostCents + breakdown.packagingPresentialCostCents,
        laborCostCents: breakdown.laborCostCents,
        totalCostCents: breakdown.onlineTotalCostCents,
        componentCostsJson: JSON.stringify(componentLines),
        metadataJson: JSON.stringify(metadata ?? {}),
        createdAt: now(),
      });
    },

    async listByProduct(params: {
      productId: string;
      source?: string;
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
    }) {
      const page = Math.max(1, Math.floor(params.page ?? 1));
      const limit = Math.min(100, Math.max(1, Math.floor(params.limit ?? 50)));
      const { items, total } = await snapshotRepo.findByProduct({
        productId: params.productId,
        source: params.source,
        from: params.from,
        to: params.to,
        limit,
        offset: (page - 1) * limit,
      });
      const mapped = items.map((row) => {
        const { componentCostsJson, ...rest } = row;
        return {
          ...rest,
          componentCosts: parseComponentCostsField(componentCostsJson),
        };
      });
      return { items: mapped, total };
    },

    async createForImpactedParentsByComponent(
      childProductId: string,
      source: SnapshotSource = "purchase_recalculation",
      metadata?: Record<string, unknown>,
    ) {
      const rows = await compositionRepo.findActiveByChildId(childProductId);
      const parentIds = [...new Set(rows.map((r) => r.parentProductId))];
      const created = [];
      for (const productId of parentIds) {
        created.push(await this.createFromCurrentBom(productId, source, metadata));
      }
      return created;
    },
  };
}
