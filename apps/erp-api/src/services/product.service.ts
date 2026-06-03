import type { AppDb } from "../db/client.js";
import type { DocumentFile } from "../db/schema/index.js";
import { generateId } from "../utils/id.js";
import { NotFoundError, ConflictError, BadRequestError } from "../errors/app-error.js";
import { createProductRepository } from "../repositories/product.repository.js";
import { createDocumentRepository } from "../repositories/document.repository.js";
import type { StorageProvider } from "../storage/storage-provider.js";
import { createProductCompositionRepository } from "../repositories/product-composition.repository.js";
import { createLineCompositionRepository } from "../repositories/line-composition.repository.js";
import { mergeEffectiveComposition } from "../domain/composition-merge.js";
import { createProductProductionProfileRepository } from "../repositories/product-production-profile.repository.js";
import { createAuditRepository } from "../repositories/audit.repository.js";
import {
  calculateLaborCostCents,
  childCostUnitBasisForProduct,
  compositionLineUsesLegacyCostRisk,
  lineCostCentsFromComposition,
} from "../domain/product-cost.js";
import { createInventoryRepository } from "../repositories/inventory.repository.js";
import { createPurchaseRepository } from "../repositories/purchase.repository.js";
import { createProductCostService } from "./product-cost.service.js";
import type {
  CreateProductInput,
  UpdateProductInput,
  CreateVariantInput,
  UpdateProductVariantInput,
  CreateCategoryInput,
  CreateLineInput,
  PermanentDeleteProductInput,
} from "../schemas/product.schemas.js";
import { createProductVariantRepository } from "../repositories/product-variant.repository.js";
import { createProductVariantService } from "./product-variant.service.js";
import type { ListProductsParams } from "../repositories/product.repository.js";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function defaultControlsStock(productType: CreateProductInput["productType"]): boolean {
  return productType !== "service";
}

function defaultSellable(productType: CreateProductInput["productType"]): boolean {
  return productType === "finished_product" || productType === "kit" || productType === "bundle";
}

export function createProductService(db: AppDb) {
  const productsRepo = createProductRepository(db);
  const variantsRepo = createProductVariantRepository(db);
  const variantSvc = createProductVariantService(db);
  const compositionsRepo = createProductCompositionRepository(db);
  const lineCompositionsRepo = createLineCompositionRepository(db);
  const profileRepo = createProductProductionProfileRepository(db);
  const costService = createProductCostService(db);
  const auditRepo = createAuditRepository(db);
  const inventoryRepo = createInventoryRepository(db);
  const purchaseRepo = createPurchaseRepository(db);
  const now = () => new Date().toISOString();

  return {
    async create(input: CreateProductInput, actorId?: string) {
      const existing = await productsRepo.findBySku(input.sku);
      if (existing) throw new ConflictError(`SKU '${input.sku}' already exists`);
      const variantSkuHit = await variantsRepo.findBySku(input.sku);
      if (variantSkuHit) throw new ConflictError(`SKU '${input.sku}' já existe numa variação.`);

      const slug = input.slug ? slugify(input.slug) : slugify(input.name);
      const productKind = input.productKind ?? "simple";
      const isVariable = productKind === "variable";
      let controlsStock = input.controlsStock ?? defaultControlsStock(input.productType);
      let sellable = input.sellable ?? defaultSellable(input.productType);
      if (isVariable) {
        controlsStock = false;
        sellable = false;
      }
      const externalRef = await productsRepo.allocateNextExternalRef();

      const product = await productsRepo.insert({
        id: generateId(),
        sku: input.sku,
        externalRef,
        name: input.name,
        slug,
        productKind,
        description: input.description ?? null,
        shortDescription: input.shortDescription ?? null,
        internalName: input.internalName ?? null,
        internalDescription: input.internalDescription ?? null,
        productType: input.productType,
        categoryId: input.categoryId ?? null,
        lineId: input.lineId ?? null,
        niche: input.niche ?? null,
        brand: input.brand ?? null,
        status: input.status,
        unitOfMeasure: input.unitOfMeasure,
        barcode: input.barcode ?? null,
        ncm: input.ncm ?? null,
        cest: input.cest ?? null,
        cfopDefault: input.cfopDefault ?? null,
        origin: input.origin,
        costPriceCents: input.costPriceCents,
        salePriceCents: input.salePriceCents,
        compareAtPriceCents: input.compareAtPriceCents ?? null,
        promotionalPriceCents: input.promotionalPriceCents ?? null,
        eventPriceCents: input.eventPriceCents ?? null,
        wholesalePriceCents: input.wholesalePriceCents ?? null,
        controlsStock,
        currentStock: 0,
        minStock: input.minStock,
        maxStock: input.maxStock ?? null,
        idealStock: input.idealStock ?? null,
        defaultStockLocationId: input.defaultStockLocationId ?? null,
        weightGrams: input.weightGrams ?? null,
        lengthCm: input.lengthCm ?? null,
        widthCm: input.widthCm ?? null,
        heightCm: input.heightCm ?? null,
        producedInternally: input.producedInternally ?? false,
        averageProductionTimeMinutes: input.averageProductionTimeMinutes ?? null,
        sellable,
        availableForEcommerce: input.availableForEcommerce ?? true,
        availableForPos: input.availableForPos ?? true,
        availableForEvents: input.availableForEvents ?? false,
        mainImageFileId: input.mainImageFileId ?? null,
        imagesJson: JSON.stringify(input.imagesJson?.length ? input.imagesJson : []),
        attributesJson: "{}",
        metadataJson: input.metadata ? JSON.stringify(input.metadata) : "{}",
        createdAt: now(),
        updatedAt: now(),
        archivedAt: null,
        deletedAt: null,
      });

      await auditRepo.insert({
        id: generateId(),
        actorId: actorId ?? null,
        actorType: "user",
        action: "product.created",
        entityType: "product",
        entityId: product.id,
        afterJson: JSON.stringify(product),
        createdAt: now(),
      });

      const laborCalc = calculateLaborCostCents(
        input.averageProductionTimeMinutes ?? null,
        input.laborCostPerHourCents ?? null,
      );
      await profileRepo.insert({
        id: generateId(),
        productId: product.id,
        producedInternally: input.producedInternally ?? false,
        averageProductionTimeMinutes: input.averageProductionTimeMinutes ?? null,
        laborCostPerHourCents: input.laborCostPerHourCents ?? null,
        laborCostCalculatedCents: laborCalc,
        notes: input.productionProfileNotes ?? null,
        createdAt: now(),
        updatedAt: now(),
      });

      return product;
    },

    async findById(id: string) {
      const product = await productsRepo.findById(id);
      if (!product) throw new NotFoundError("Product", id);
      return product;
    },

    async listProducts(params: ListProductsParams & { page?: number; composeCatalog?: boolean }) {
      const { page = 1, limit = 20, ...rest } = params;
      const { items, total } = await productsRepo.listPaginated({
        ...rest,
        limit,
        offset: (page - 1) * limit,
      });
      const ids = items.map((p) => p.id);
      const vRows = await variantsRepo.listActiveByProductIds(ids);
      const byPid = new Map<string, typeof vRows>();
      for (const v of vRows) {
        const arr = byPid.get(v.productId) ?? [];
        arr.push(v);
        byPid.set(v.productId, arr);
      }
      const effSale = (p: (typeof items)[number], v: (typeof vRows)[number]) =>
        v.salePriceCents ?? p.salePriceCents;
      const itemsOut = items.map((p) => {
        const vs = byPid.get(p.id) ?? [];
        const variantCount = vs.length;
        let minEffectiveSaleCents = p.salePriceCents;
        let maxEffectiveSaleCents = p.salePriceCents;
        if (p.productKind === "variable" && vs.length > 0) {
          const prices = vs.map((v) => effSale(p, v));
          minEffectiveSaleCents = Math.min(...prices);
          maxEffectiveSaleCents = Math.max(...prices);
        }
        return {
          ...p,
          variantCount,
          minEffectiveSaleCents,
          maxEffectiveSaleCents,
        };
      });
      return { items: itemsOut, total, page, limit };
    },

    /** @deprecated Use listProducts (retorna também total). */
    async findMany(params: ListProductsParams & { page?: number; composeCatalog?: boolean }) {
      const r = await this.listProducts(params);
      return r.items;
    },

    async findLowStock() {
      return productsRepo.findLowStock();
    },

    async getOperationalDetail(id: string) {
      const product = await this.findById(id);
      const productCompositionRows = await compositionsRepo.findActiveByParentId(id);
      const lineCompositionRows = product.lineId
        ? await lineCompositionsRepo.findActiveByParentLineId(product.lineId)
        : [];
      const effectiveRows = mergeEffectiveComposition(lineCompositionRows, productCompositionRows);

      const allChildIds = [
        ...new Set([
          ...effectiveRows.map((c) => c.childProductId),
          ...productCompositionRows.map((c) => c.childProductId),
          ...lineCompositionRows.map((c) => c.childProductId),
        ]),
      ];
      const children = await productsRepo.findByIds(allChildIds);
      const childMap = new Map(children.map((c) => [c.id, c]));
      const profile = await profileRepo.findByProductId(id);
      const costBreakdown = await costService.getBreakdownForParentProduct(id);

      const latestReceiptByChild = await purchaseRepo.findLatestReceiptIdPerProductIds(allChildIds);

      const mapCompositionWithChild = (c: (typeof effectiveRows)[number]) => {
        const ch = childMap.get(c.childProductId);
        const { unitCostCents, totalCostCents } = ch
          ? lineCostCentsFromComposition(c.quantity, ch)
          : { unitCostCents: 0, totalCostCents: 0 };
        const basis = ch ? childCostUnitBasisForProduct(ch) : "legacy_cost_price";
        return {
          ...c,
          scope: c.scope,
          sourceCompositionId: c.sourceCompositionId,
          childSku: ch?.sku ?? null,
          childName: ch?.name ?? null,
          childProductType: ch?.productType ?? null,
          childCostPriceCents: ch?.costPriceCents ?? 0,
          childUnitCostCents: unitCostCents,
          lineCostCents: totalCostCents,
          childCostSource: ch?.costSource ?? null,
          childCostUpdatedAt: ch?.costUpdatedAt ?? null,
          childLastPurchaseDate: ch?.lastPurchaseDate ?? null,
          childUnitCostBasis: basis,
          childLegacyCostWarning: ch ? compositionLineUsesLegacyCostRisk(ch) : true,
          childAverageCostUnit: ch?.averageCostUnit ?? null,
          childLatestReceiptId: latestReceiptByChild.get(c.childProductId) ?? null,
        };
      };

      const compositionsWithChild = effectiveRows.map(mapCompositionWithChild);

      const productCompositionsWithChild = productCompositionRows.map((c) =>
        mapCompositionWithChild({
          ...c,
          scope: "product" as const,
          sourceCompositionId: c.id,
        }),
      );

      const lineCompositionsWithChild = lineCompositionRows.map((c) =>
        mapCompositionWithChild({
          ...c,
          scope: "line" as const,
          sourceCompositionId: c.id,
        }),
      );

      const movements = await inventoryRepo.findMovementsByProduct(id, 80);
      const locationIds = [...new Set(movements.map((m) => m.locationId))];
      const locationRows = await Promise.all(
        locationIds.map((lid) => inventoryRepo.findLocationById(lid)),
      );
      const locNameById = new Map(locationRows.filter(Boolean).map((l) => [l!.id, l!.name]));

      const stockMovements = movements.map((m) => ({
        id: m.id,
        type: m.type,
        quantity: m.quantity,
        unitCostCents: m.unitCostCents,
        referenceType: m.referenceType,
        referenceId: m.referenceId,
        notes: m.notes,
        createdAt: m.createdAt,
        locationName: locNameById.get(m.locationId) ?? m.locationId,
      }));

      const receiptJoinRows = await purchaseRepo.findReceiptItemsForProduct(id, 40);
      const purchaseReceiptHistory = receiptJoinRows.map(({ item, receipt }) => ({
        receiptId: receipt.id,
        receivedAt: receipt.receivedAt,
        issueDate: receipt.issueDate,
        documentType: receipt.documentType,
        documentNumber: receipt.documentNumber,
        stockQuantity: item.stockQuantity,
        stockUnit: item.stockUnit,
        totalCostCents: item.totalCostCents,
        receiptItemId: item.id,
      }));

      const asChildCompositions = await compositionsRepo.findActiveByChildId(id);
      const parentIds = [...new Set(asChildCompositions.map((c) => c.parentProductId))];
      const parentProducts = parentIds.length ? await productsRepo.findByIds(parentIds) : [];
      const parentMap = new Map(parentProducts.map((p) => [p.id, p]));
      const bomParentsGrouped = new Map<string, number>();
      for (const c of asChildCompositions) {
        bomParentsGrouped.set(
          c.parentProductId,
          (bomParentsGrouped.get(c.parentProductId) ?? 0) + 1,
        );
      }
      const bomParents = [...bomParentsGrouped.entries()].map(([parentProductId, lineCount]) => {
        const p = parentMap.get(parentProductId);
        return {
          parentProductId,
          parentSku: p?.sku ?? null,
          parentName: p?.name ?? null,
          lineCount,
        };
      });

      const mergedProduct = {
        ...product,
        producedInternally: profile?.producedInternally ?? product.producedInternally,
        averageProductionTimeMinutes:
          profile?.averageProductionTimeMinutes ?? product.averageProductionTimeMinutes,
        laborCostPerHourCents: profile?.laborCostPerHourCents ?? null,
        laborCostCalculatedCents: profile?.laborCostCalculatedCents ?? null,
        productionProfileNotes: profile?.notes ?? null,
      };

      const variants = await variantSvc.listByProduct(id);

      return {
        product: mergedProduct,
        compositions: compositionsWithChild,
        effectiveCompositions: compositionsWithChild,
        productCompositions: productCompositionsWithChild,
        lineCompositions: lineCompositionsWithChild,
        children,
        costBreakdown,
        variants,
        stockMovements,
        purchaseReceiptHistory,
        bomParents,
      };
    },

    async listAuditLogsForProduct(productId: string) {
      return auditRepo.findByEntity("product", productId, 100);
    },

    async update(id: string, input: UpdateProductInput, actorId?: string) {
      const existing = await productsRepo.findById(id);
      if (!existing) throw new NotFoundError("Product", id);

      if (input.sku && input.sku !== existing.sku) {
        const skuConflict = await productsRepo.findBySku(input.sku);
        if (skuConflict) throw new ConflictError(`SKU '${input.sku}' already exists`);
        const vSku = await variantsRepo.findBySku(input.sku);
        if (vSku) throw new ConflictError(`SKU '${input.sku}' já existe numa variação.`);
      }

      if (input.productKind === "variable" && existing.productKind === "simple") {
        if (existing.currentStock !== 0) {
          throw new BadRequestError(
            'Zere o estoque do produto antes de mudar a estrutura para "com variações".',
          );
        }
      }
      if (input.productKind === "simple" && existing.productKind === "variable") {
        const activeVariants = await variantsRepo.countActiveByProductId(id);
        if (activeVariants > 0) {
          throw new BadRequestError(
            "Arquive todas as variações antes de voltar a produto simples.",
          );
        }
      }

      const {
        metadata,
        slug: slugInput,
        imagesJson,
        laborCostPerHourCents,
        productionProfileNotes,
        productKind: productKindInput,
        ...rest
      } = input;
      const existingProfile = await profileRepo.findByProductId(id);
      const nextProduced =
        input.producedInternally !== undefined
          ? input.producedInternally
          : (existingProfile?.producedInternally ?? existing.producedInternally);
      const nextAvg =
        input.averageProductionTimeMinutes !== undefined
          ? input.averageProductionTimeMinutes
          : (existingProfile?.averageProductionTimeMinutes ??
            existing.averageProductionTimeMinutes);
      const nextLaborHour =
        laborCostPerHourCents !== undefined
          ? laborCostPerHourCents
          : (existingProfile?.laborCostPerHourCents ?? null);
      const nextNotes =
        productionProfileNotes !== undefined
          ? productionProfileNotes
          : (existingProfile?.notes ?? null);
      const laborCalc = calculateLaborCostCents(nextAvg, nextLaborHour);

      const patch: Record<string, unknown> = { ...rest };
      if (productKindInput !== undefined) {
        patch.productKind = productKindInput;
        if (productKindInput === "variable") {
          patch.controlsStock = false;
          patch.sellable = false;
        }
      }
      if (slugInput !== undefined) patch.slug = slugify(slugInput);
      if (metadata !== undefined) patch.metadataJson = JSON.stringify(metadata);
      if (imagesJson !== undefined) patch.imagesJson = JSON.stringify(imagesJson);
      patch.producedInternally = nextProduced;
      patch.averageProductionTimeMinutes = nextAvg ?? null;

      const filtered = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));

      const updated = await productsRepo.update(id, filtered as never);

      if (updated.productKind === "variable") {
        await productsRepo.syncAggregatedStockFromVariants(id);
      }

      await profileRepo.upsertByProductId({
        id: existingProfile?.id ?? generateId(),
        productId: id,
        producedInternally: nextProduced,
        averageProductionTimeMinutes: nextAvg ?? null,
        laborCostPerHourCents: nextLaborHour ?? null,
        laborCostCalculatedCents: laborCalc,
        notes: nextNotes ?? null,
        createdAt: existingProfile?.createdAt ?? now(),
        updatedAt: now(),
      });

      await auditRepo.insert({
        id: generateId(),
        actorId: actorId ?? null,
        actorType: "user",
        action: "product.updated",
        entityType: "product",
        entityId: id,
        beforeJson: JSON.stringify(existing),
        afterJson: JSON.stringify(updated),
        createdAt: now(),
      });

      return updated;
    },

    async archive(id: string, actorId?: string) {
      const existing = await productsRepo.findByIdIncludingArchived(id);
      if (!existing) throw new NotFoundError("Product", id);
      if (existing.archivedAt) {
        throw new ConflictError("Produto já está arquivado.");
      }
      await productsRepo.archive(id);
      await auditRepo.insert({
        id: generateId(),
        actorId: actorId ?? null,
        actorType: "user",
        action: "product.archived",
        entityType: "product",
        entityId: id,
        createdAt: now(),
      });
    },

    async archiveProducts(ids: string[], actorId?: string) {
      const archived = await productsRepo.archiveMany(ids);
      if (archived > 0) {
        await auditRepo.insert({
          id: generateId(),
          actorId: actorId ?? null,
          actorType: "user",
          action: "products.bulk_archived",
          entityType: "product",
          entityId: ids[0] ?? "bulk",
          metadataJson: JSON.stringify({ count: archived, sampleIds: ids.slice(0, 20) }),
          createdAt: now(),
        });
      }
      return { archived };
    },

    async restoreProduct(id: string, actorId?: string) {
      const row = await productsRepo.findByIdIncludingArchived(id);
      if (!row) throw new NotFoundError("Product", id);
      if (!row.archivedAt) {
        throw new ConflictError("Produto não está arquivado.");
      }
      await productsRepo.restore(id);
      await auditRepo.insert({
        id: generateId(),
        actorId: actorId ?? null,
        actorType: "user",
        action: "product.restored",
        entityType: "product",
        entityId: id,
        createdAt: now(),
      });
    },

    async restoreProducts(ids: string[], actorId?: string) {
      const restored = await productsRepo.restoreMany(ids);
      if (restored > 0) {
        await auditRepo.insert({
          id: generateId(),
          actorId: actorId ?? null,
          actorType: "user",
          action: "products.bulk_restored",
          entityType: "product",
          entityId: ids[0] ?? "bulk",
          metadataJson: JSON.stringify({ count: restored, sampleIds: ids.slice(0, 20) }),
          createdAt: now(),
        });
      }
      return { restored };
    },

    /**
     * Elimina permanentemente o produto na BD (cascata acordada) e remove imagens em R2 + `document_files`.
     * Chamar só após validar `confirmSku` no pedido.
     */
    async permanentDelete(
      productId: string,
      input: PermanentDeleteProductInput,
      storage: StorageProvider,
      actorId?: string,
    ) {
      const product = await productsRepo.findByIdIncludingArchived(productId);
      if (!product) throw new NotFoundError("Product", productId);
      if (product.sku.trim() !== input.confirmSku.trim()) {
        throw new BadRequestError("O SKU de confirmação não coincide com o produto.");
      }

      const docs = createDocumentRepository(db);
      const refDocs = await docs.findProductImageFiles(productId);
      const idSet = new Set<string>();
      for (const d of refDocs) idSet.add(d.id);
      if (product.mainImageFileId) idSet.add(product.mainImageFileId);
      try {
        const arr = JSON.parse(product.imagesJson || "[]") as unknown;
        if (Array.isArray(arr)) {
          for (const x of arr) {
            if (typeof x === "string" && x) idSet.add(x);
          }
        }
      } catch {
        /* ignore malformed gallery json */
      }

      const documentsToPurge: DocumentFile[] = [];
      for (const fid of idSet) {
        const row = await docs.findById(fid);
        if (row) documentsToPurge.push(row);
      }

      try {
        await productsRepo.permanentDeleteCascade(productId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/FOREIGN KEY|SQLITE_CONSTRAINT|constraint failed/i.test(msg)) {
          throw new BadRequestError(
            "Não foi possível apagar o produto: ainda há referências dependentes na base de dados. " +
              "Se usou BOM ou produção, verifique ordens e composições. Detalhe: " +
              msg,
          );
        }
        throw err;
      }

      let deletedFiles = 0;
      for (const doc of documentsToPurge) {
        try {
          await storage.deleteObject({ key: doc.storageKey });
        } catch {
          /* objeto R2 pode já não existir */
        }
        await docs.deleteById(doc.id);
        deletedFiles += 1;
      }

      await auditRepo.insert({
        id: generateId(),
        actorId: actorId ?? null,
        actorType: "user",
        action: "product.permanent_deleted",
        entityType: "product",
        entityId: productId,
        metadataJson: JSON.stringify({ sku: product.sku, deletedFileCount: deletedFiles }),
        createdAt: now(),
      });

      return { deletedFileCount: deletedFiles };
    },

    async createVariant(input: CreateVariantInput) {
      return variantSvc.create(input);
    },

    async listVariants(productId: string) {
      return variantSvc.listByProduct(productId);
    },

    async updateVariant(productId: string, variantId: string, input: UpdateProductVariantInput) {
      return variantSvc.update(variantId, input, productId);
    },

    async archiveVariant(productId: string, variantId: string) {
      return variantSvc.archive(variantId, productId);
    },

    async restoreVariant(productId: string, variantId: string) {
      return variantSvc.restore(variantId, productId);
    },

    async createCategory(input: CreateCategoryInput) {
      return productsRepo.insertCategory({
        id: generateId(),
        ...input,
        parentId: input.parentId ?? null,
        description: input.description ?? null,
        createdAt: now(),
        updatedAt: now(),
        archivedAt: null,
      });
    },

    async createLine(input: CreateLineInput) {
      return productsRepo.insertLine({
        id: generateId(),
        ...input,
        description: input.description ?? null,
        niche: input.niche ?? null,
        season: input.season ?? null,
        status: input.status,
        createdAt: now(),
        updatedAt: now(),
        archivedAt: null,
      });
    },

    async findCategories() {
      return productsRepo.findCategories();
    },

    async findLines() {
      return productsRepo.findLines();
    },
  };
}
