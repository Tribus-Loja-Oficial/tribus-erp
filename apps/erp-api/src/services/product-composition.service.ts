import type { AppDb } from "../db/client.js";
import { generateId } from "../utils/id.js";
import { NotFoundError, ConflictError, ValidationError } from "../errors/app-error.js";
import { createProductRepository } from "../repositories/product.repository.js";
import {
  createProductCompositionRepository,
  activeCompositionScopeWhere,
} from "../repositories/product-composition.repository.js";
import { productCompositions } from "../db/schema/index.js";
import { createProductCostSnapshotService } from "./product-cost-snapshot.service.js";
import { lineCostCentsFromComposition } from "../domain/product-cost.js";
import type {
  CreateProductCompositionInput,
  UpdateProductCompositionInput,
} from "../schemas/product.schemas.js";

function validateCompositionRules(opts: {
  parentProductId: string;
  childProductId: string;
  compositionType: string;
  packagingChannel?: string | null;
  quantity: number;
}) {
  if (!(opts.quantity > 0)) {
    throw new ValidationError("Quantidade deve ser maior que zero");
  }
  if (opts.parentProductId === opts.childProductId) {
    throw new ValidationError("O produto não pode ser componente dele mesmo");
  }
  if (opts.compositionType === "packaging") {
    if (
      opts.packagingChannel !== "online" &&
      opts.packagingChannel !== "presential" &&
      opts.packagingChannel !== "both"
    ) {
      throw new ValidationError("Embalagem exige canal: online, presencial ou ambos");
    }
  } else if (opts.packagingChannel != null) {
    throw new ValidationError("Canal de embalagem só se aplica a composição do tipo embalagem");
  }
}

export function createProductCompositionService(db: AppDb) {
  const productsRepo = createProductRepository(db);
  const compositionsRepo = createProductCompositionRepository(db);
  const snapshotService = createProductCostSnapshotService(db);
  const now = () => new Date().toISOString();

  return {
    async listByParent(parentProductId: string) {
      const p = await productsRepo.findById(parentProductId);
      if (!p) throw new NotFoundError("Product", parentProductId);
      return compositionsRepo.findActiveByParentId(parentProductId);
    },

    async add(parentProductId: string, input: CreateProductCompositionInput) {
      const parent = await productsRepo.findById(parentProductId);
      if (!parent) throw new NotFoundError("Product", parentProductId);
      const child = await productsRepo.findById(input.childProductId);
      if (!child) throw new NotFoundError("Product", input.childProductId);

      validateCompositionRules({
        parentProductId,
        childProductId: input.childProductId,
        compositionType: input.compositionType,
        packagingChannel: input.packagingChannel,
        quantity: input.quantity,
      });

      const packagingChannel =
        input.compositionType === "packaging" ? input.packagingChannel! : null;

      const { unitCostCents, totalCostCents } = lineCostCentsFromComposition(input.quantity, child);

      try {
        const created = await compositionsRepo.insert({
          id: generateId(),
          parentProductId,
          parentVariantId: null,
          childProductId: input.childProductId,
          childVariantId: null,
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
        await snapshotService.createFromCurrentBom(parentProductId, "pricing_review", {
          trigger: "composition_add",
          compositionId: created.id,
        });
        return created;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("UNIQUE") || msg.toLowerCase().includes("unique")) {
          throw new ConflictError(
            "Já existe composição equivalente para este produto (verifique duplicados ou embalagem no mesmo canal).",
          );
        }
        throw e;
      }
    },

    async update(
      parentProductId: string,
      compositionId: string,
      input: UpdateProductCompositionInput,
    ) {
      const row = await compositionsRepo.findById(compositionId);
      if (!row || row.archivedAt) throw new NotFoundError("ProductComposition", compositionId);
      if (row.parentProductId !== parentProductId) {
        throw new ValidationError("Composição não pertence a este produto");
      }

      const nextType = input.compositionType ?? row.compositionType;
      const nextChildId = input.childProductId ?? row.childProductId;
      const nextQty = input.quantity ?? row.quantity;
      const nextChannel =
        input.packagingChannel !== undefined ? input.packagingChannel : row.packagingChannel;

      validateCompositionRules({
        parentProductId,
        childProductId: nextChildId,
        compositionType: nextType,
        packagingChannel: nextType === "packaging" ? nextChannel : null,
        quantity: nextQty,
      });

      if (input.childProductId !== undefined) {
        if (input.childProductId === parentProductId) {
          throw new ValidationError("O produto não pode ser componente dele mesmo");
        }
        const ch = await productsRepo.findById(input.childProductId);
        if (!ch) throw new NotFoundError("Product", input.childProductId);
      }

      const child = await productsRepo.findById(nextChildId);
      if (!child) throw new NotFoundError("Product", nextChildId);

      const packagingChannel: "online" | "presential" | "both" | null =
        nextType === "packaging" ? (nextChannel as "online" | "presential" | "both") : null;

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

      const updated = await compositionsRepo.update(compositionId, patch as never);
      await snapshotService.createFromCurrentBom(parentProductId, "pricing_review", {
        trigger: "composition_update",
        compositionId: updated.id,
      });
      return updated;
    },

    async archive(parentProductId: string, compositionId: string) {
      const row = await compositionsRepo.findById(compositionId);
      if (!row || row.archivedAt) throw new NotFoundError("ProductComposition", compositionId);
      if (row.parentProductId !== parentProductId) {
        throw new ValidationError("Composição não pertence a este produto");
      }
      await compositionsRepo.archive(compositionId);
      await snapshotService.createFromCurrentBom(parentProductId, "pricing_review", {
        trigger: "composition_archive",
        compositionId,
      });
    },

    /**
     * Arquiva linhas activas no escopo (`replaceTypes` + filtro opcional de canal de embalagem)
     * e insere as novas linhas num único `db.batch` (D1), depois um snapshot de custo.
     */
    async replaceCompositionScope(params: {
      parentProductId: string;
      replaceTypes: readonly ("packaging" | "bom" | "kit" | "bundle" | "accessory" | "included")[];
      packagingChannel?: "online" | "presential" | "both";
      lines: CreateProductCompositionInput[];
    }): Promise<{ removedCount: number; createdCount: number }> {
      const parent = await productsRepo.findById(params.parentProductId);
      if (!parent) throw new NotFoundError("Product", params.parentProductId);

      const ts = now();
      const newRows: (typeof productCompositions.$inferInsert)[] = [];

      for (const input of params.lines) {
        const child = await productsRepo.findById(input.childProductId);
        if (!child) throw new NotFoundError("Product", input.childProductId);

        validateCompositionRules({
          parentProductId: params.parentProductId,
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
          parentProductId: params.parentProductId,
          parentVariantId: null,
          childProductId: input.childProductId,
          childVariantId: null,
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

      const removedCount = await compositionsRepo.countActiveInScope(
        params.parentProductId,
        params.replaceTypes,
        params.packagingChannel,
      );

      const scopeWhere = activeCompositionScopeWhere(
        params.parentProductId,
        params.replaceTypes,
        params.packagingChannel,
      );

      const batchSteps = [
        db.update(productCompositions).set({ archivedAt: ts, updatedAt: ts }).where(scopeWhere),
        ...newRows.map((row) => db.insert(productCompositions).values(row)),
      ];

      try {
        await db.batch(batchSteps as never);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("UNIQUE") || msg.toLowerCase().includes("unique")) {
          throw new ConflictError(
            "Já existe composição equivalente para este produto (verifique duplicados ou embalagem no mesmo canal).",
          );
        }
        throw e;
      }

      await snapshotService.createFromCurrentBom(params.parentProductId, "pricing_review", {
        trigger: "composition_bulk_replace",
      });

      return { removedCount, createdCount: newRows.length };
    },
  };
}
