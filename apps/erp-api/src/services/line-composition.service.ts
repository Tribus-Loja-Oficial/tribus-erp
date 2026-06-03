import type { AppDb } from "../db/client.js";
import { generateId } from "../utils/id.js";
import { NotFoundError, ConflictError, ValidationError } from "../errors/app-error.js";
import { createProductRepository } from "../repositories/product.repository.js";
import {
  createLineCompositionRepository,
  activeLineCompositionScopeWhere,
} from "../repositories/line-composition.repository.js";
import { lineCompositions } from "../db/schema/index.js";
import { createProductCostSnapshotService } from "./product-cost-snapshot.service.js";
import { lineCostCentsFromComposition } from "../domain/product-cost.js";
import type {
  CreateProductCompositionInput,
  UpdateProductCompositionInput,
} from "../schemas/product.schemas.js";

function validateLineCompositionRules(opts: {
  parentLineId: string;
  childProductId: string;
  compositionType: string;
  packagingChannel?: string | null;
  quantity: number;
}) {
  if (!(opts.quantity > 0)) {
    throw new ValidationError("Quantidade deve ser maior que zero");
  }
  if (opts.compositionType === "packaging") {
    if (opts.packagingChannel !== "online" && opts.packagingChannel !== "presential") {
      throw new ValidationError("Embalagem exige canal: online ou presencial");
    }
  } else if (opts.packagingChannel != null) {
    throw new ValidationError("Canal de embalagem só se aplica a composição do tipo embalagem");
  }
}

export function createLineCompositionService(db: AppDb) {
  const productsRepo = createProductRepository(db);
  const lineCompositionsRepo = createLineCompositionRepository(db);
  const snapshotService = createProductCostSnapshotService(db);
  const now = () => new Date().toISOString();

  async function recalcSnapshotsForLine(lineId: string, metadata?: Record<string, unknown>) {
    const productIds = await productsRepo.findProductIdsByLineId(lineId);
    for (const productId of productIds) {
      await snapshotService.createFromCurrentBom(productId, "pricing_review", {
        trigger: "line_composition_change",
        lineId,
        ...metadata,
      });
    }
  }

  return {
    async listByLine(lineId: string) {
      const line = await productsRepo.findLineById(lineId);
      if (!line) throw new NotFoundError("ProductLine", lineId);
      return lineCompositionsRepo.findActiveByParentLineId(lineId);
    },

    async add(parentLineId: string, input: CreateProductCompositionInput) {
      const line = await productsRepo.findLineById(parentLineId);
      if (!line) throw new NotFoundError("ProductLine", parentLineId);
      const child = await productsRepo.findById(input.childProductId);
      if (!child) throw new NotFoundError("Product", input.childProductId);

      validateLineCompositionRules({
        parentLineId,
        childProductId: input.childProductId,
        compositionType: input.compositionType,
        packagingChannel: input.packagingChannel,
        quantity: input.quantity,
      });

      const packagingChannel =
        input.compositionType === "packaging" ? input.packagingChannel! : null;

      const { unitCostCents, totalCostCents } = lineCostCentsFromComposition(input.quantity, child);

      try {
        const created = await lineCompositionsRepo.insert({
          id: generateId(),
          parentLineId,
          childProductId: input.childProductId,
          quantity: input.quantity,
          quantityUnit: input.quantityUnit ?? null,
          compositionType: input.compositionType,
          packagingChannel,
          unitCostSnapshotCents: unitCostCents,
          totalCostSnapshotCents: totalCostCents,
          required: input.required,
          isDefault: input.isDefault,
          notes: input.notes ?? null,
          createdAt: now(),
          updatedAt: now(),
          archivedAt: null,
        });
        await recalcSnapshotsForLine(parentLineId, {
          compositionId: created.id,
          action: "add",
        });
        return created;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("UNIQUE") || msg.toLowerCase().includes("unique")) {
          throw new ConflictError(
            "Já existe composição equivalente para esta linha (verifique duplicados ou embalagem no mesmo canal).",
          );
        }
        throw e;
      }
    },

    async update(
      parentLineId: string,
      compositionId: string,
      input: UpdateProductCompositionInput,
    ) {
      const row = await lineCompositionsRepo.findById(compositionId);
      if (!row || row.archivedAt) throw new NotFoundError("LineComposition", compositionId);
      if (row.parentLineId !== parentLineId) {
        throw new ValidationError("Composição não pertence a esta linha");
      }

      const nextType = input.compositionType ?? row.compositionType;
      const nextChildId = input.childProductId ?? row.childProductId;
      const nextQty = input.quantity ?? row.quantity;
      const nextChannel =
        input.packagingChannel !== undefined ? input.packagingChannel : row.packagingChannel;

      validateLineCompositionRules({
        parentLineId,
        childProductId: nextChildId,
        compositionType: nextType,
        packagingChannel: nextType === "packaging" ? nextChannel : null,
        quantity: nextQty,
      });

      const child = await productsRepo.findById(nextChildId);
      if (!child) throw new NotFoundError("Product", nextChildId);

      const packagingChannel: "online" | "presential" | null =
        nextType === "packaging" ? (nextChannel as "online" | "presential") : null;

      const { unitCostCents, totalCostCents } = lineCostCentsFromComposition(nextQty, child);

      const patch: Record<string, unknown> = {
        unitCostSnapshotCents: unitCostCents,
        totalCostSnapshotCents: totalCostCents,
        packagingChannel,
      };
      if (input.childProductId !== undefined) patch.childProductId = input.childProductId;
      if (input.quantity !== undefined) patch.quantity = input.quantity;
      if (input.quantityUnit !== undefined) patch.quantityUnit = input.quantityUnit;
      if (input.compositionType !== undefined) patch.compositionType = input.compositionType;
      if (input.required !== undefined) patch.required = input.required;
      if (input.isDefault !== undefined) patch.isDefault = input.isDefault;
      if (input.notes !== undefined) patch.notes = input.notes;

      const updated = await lineCompositionsRepo.update(compositionId, patch as never);
      await recalcSnapshotsForLine(parentLineId, {
        compositionId: updated.id,
        action: "update",
      });
      return updated;
    },

    async archive(parentLineId: string, compositionId: string) {
      const row = await lineCompositionsRepo.findById(compositionId);
      if (!row || row.archivedAt) throw new NotFoundError("LineComposition", compositionId);
      if (row.parentLineId !== parentLineId) {
        throw new ValidationError("Composição não pertence a esta linha");
      }
      await lineCompositionsRepo.archive(compositionId);
      await recalcSnapshotsForLine(parentLineId, {
        compositionId,
        action: "archive",
      });
    },

    async replaceCompositionScope(params: {
      parentLineId: string;
      replaceTypes: readonly ("packaging" | "bom" | "kit" | "bundle" | "accessory" | "included")[];
      packagingChannel?: "online" | "presential";
      lines: CreateProductCompositionInput[];
    }): Promise<{ removedCount: number; createdCount: number }> {
      const line = await productsRepo.findLineById(params.parentLineId);
      if (!line) throw new NotFoundError("ProductLine", params.parentLineId);

      const ts = now();
      const newRows: (typeof lineCompositions.$inferInsert)[] = [];

      for (const input of params.lines) {
        const child = await productsRepo.findById(input.childProductId);
        if (!child) throw new NotFoundError("Product", input.childProductId);

        validateLineCompositionRules({
          parentLineId: params.parentLineId,
          childProductId: input.childProductId,
          compositionType: input.compositionType,
          packagingChannel: input.packagingChannel,
          quantity: input.quantity,
        });

        const packagingChannelRow =
          input.compositionType === "packaging" ? input.packagingChannel! : null;

        const { unitCostCents, totalCostCents } = lineCostCentsFromComposition(
          input.quantity,
          child,
        );

        newRows.push({
          id: generateId(),
          parentLineId: params.parentLineId,
          childProductId: input.childProductId,
          quantity: input.quantity,
          quantityUnit: input.quantityUnit ?? null,
          compositionType: input.compositionType,
          packagingChannel: packagingChannelRow,
          unitCostSnapshotCents: unitCostCents,
          totalCostSnapshotCents: totalCostCents,
          required: input.required,
          isDefault: input.isDefault,
          notes: input.notes ?? null,
          createdAt: ts,
          updatedAt: ts,
          archivedAt: null,
        });
      }

      const removedCount = await lineCompositionsRepo.countActiveInScope(
        params.parentLineId,
        params.replaceTypes,
        params.packagingChannel,
      );

      const scopeWhere = activeLineCompositionScopeWhere(
        params.parentLineId,
        params.replaceTypes,
        params.packagingChannel,
      );

      const batchSteps = [
        db.update(lineCompositions).set({ archivedAt: ts, updatedAt: ts }).where(scopeWhere),
        ...newRows.map((row) => db.insert(lineCompositions).values(row)),
      ];

      try {
        await db.batch(batchSteps as never);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("UNIQUE") || msg.toLowerCase().includes("unique")) {
          throw new ConflictError(
            "Já existe composição equivalente para esta linha (verifique duplicados ou embalagem no mesmo canal).",
          );
        }
        throw e;
      }

      await recalcSnapshotsForLine(params.parentLineId, { trigger: "composition_bulk_replace" });

      return { removedCount, createdCount: newRows.length };
    },
  };
}
