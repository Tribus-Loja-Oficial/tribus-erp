import type { AppDb } from "../db/client.js";
import type { DocumentFile } from "../db/schema/index.js";
import { generateId } from "../utils/id.js";
import { NotFoundError, ConflictError, BadRequestError } from "../errors/app-error.js";
import { createProductRepository } from "../repositories/product.repository.js";
import { createDocumentRepository } from "../repositories/document.repository.js";
import type { StorageProvider } from "../storage/storage-provider.js";
import { createProductCompositionRepository } from "../repositories/product-composition.repository.js";
import { createProductProductionProfileRepository } from "../repositories/product-production-profile.repository.js";
import { createAuditRepository } from "../repositories/audit.repository.js";
import {
  calculateLaborCostCents,
  deriveCostPerConsumptionUnitCents,
  lineCostCentsFromComposition,
} from "../domain/product-cost.js";
import { createProductCostService } from "./product-cost.service.js";
import type {
  CreateProductInput,
  UpdateProductInput,
  CreateVariantInput,
  CreateCategoryInput,
  CreateCollectionInput,
  PermanentDeleteProductInput,
} from "../schemas/product.schemas.js";
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
  const compositionsRepo = createProductCompositionRepository(db);
  const profileRepo = createProductProductionProfileRepository(db);
  const costService = createProductCostService(db);
  const auditRepo = createAuditRepository(db);
  const now = () => new Date().toISOString();

  return {
    async create(input: CreateProductInput, actorId?: string) {
      const existing = await productsRepo.findBySku(input.sku);
      if (existing) throw new ConflictError(`SKU '${input.sku}' already exists`);

      const slug = input.slug ? slugify(input.slug) : slugify(input.name);
      const controlsStock = input.controlsStock ?? defaultControlsStock(input.productType);
      const sellable = input.sellable ?? defaultSellable(input.productType);

      const product = await productsRepo.insert({
        id: generateId(),
        sku: input.sku,
        name: input.name,
        slug,
        description: input.description ?? null,
        shortDescription: input.shortDescription ?? null,
        internalName: input.internalName ?? null,
        internalDescription: input.internalDescription ?? null,
        productType: input.productType,
        categoryId: input.categoryId ?? null,
        collectionId: input.collectionId ?? null,
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
        purchaseUnit: input.purchaseUnit ?? null,
        purchaseQuantity: input.purchaseQuantity ?? null,
        consumptionUnit: input.consumptionUnit ?? null,
        acquisitionCostCents: input.acquisitionCostCents ?? null,
        costPerConsumptionUnitCents:
          input.costPerConsumptionUnitCents ??
          deriveCostPerConsumptionUnitCents({
            acquisitionCostCents: input.acquisitionCostCents ?? null,
            purchaseQuantity: input.purchaseQuantity ?? null,
          }) ??
          null,
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
      return { items, total, page, limit };
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
      const compositions = await compositionsRepo.findActiveByParentId(id);
      const childIds = [...new Set(compositions.map((c) => c.childProductId))];
      const children = await productsRepo.findByIds(childIds);
      const childMap = new Map(children.map((c) => [c.id, c]));
      const profile = await profileRepo.findByProductId(id);
      const costBreakdown = await costService.getBreakdownForParentProduct(id);

      const compositionsWithChild = compositions.map((c) => {
        const ch = childMap.get(c.childProductId);
        const { unitCostCents, totalCostCents } = ch
          ? lineCostCentsFromComposition(c.quantity, ch)
          : { unitCostCents: 0, totalCostCents: 0 };
        return {
          ...c,
          childSku: ch?.sku ?? null,
          childName: ch?.name ?? null,
          childProductType: ch?.productType ?? null,
          childCostPriceCents: ch?.costPriceCents ?? 0,
          childUnitCostCents: unitCostCents,
          lineCostCents: totalCostCents,
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

      return {
        product: mergedProduct,
        compositions: compositionsWithChild,
        children,
        costBreakdown,
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
      }

      const {
        metadata,
        slug: slugInput,
        imagesJson,
        laborCostPerHourCents,
        productionProfileNotes,
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
      if (slugInput !== undefined) patch.slug = slugify(slugInput);
      if (metadata !== undefined) patch.metadataJson = JSON.stringify(metadata);
      if (imagesJson !== undefined) patch.imagesJson = JSON.stringify(imagesJson);
      patch.producedInternally = nextProduced;
      patch.averageProductionTimeMinutes = nextAvg ?? null;

      const acq = patch.acquisitionCostCents ?? existing.acquisitionCostCents;
      const pq = patch.purchaseQuantity ?? existing.purchaseQuantity;
      if (
        patch.costPerConsumptionUnitCents === undefined &&
        acq != null &&
        pq != null &&
        (patch.acquisitionCostCents !== undefined || patch.purchaseQuantity !== undefined)
      ) {
        const derived = deriveCostPerConsumptionUnitCents({
          acquisitionCostCents: acq as number,
          purchaseQuantity: pq as number,
        });
        if (derived != null) patch.costPerConsumptionUnitCents = derived;
      }

      const filtered = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));

      const updated = await productsRepo.update(id, filtered as never);

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

      await productsRepo.permanentDeleteCascade(productId);

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
      const product = await productsRepo.findById(input.productId);
      if (!product) throw new NotFoundError("Product", input.productId);
      const { createProductVariantRepository } =
        await import("../repositories/product-variant.repository.js");
      const variantsRepo = createProductVariantRepository(db);
      return variantsRepo.insert({
        id: generateId(),
        ...input,
        attributesJson: JSON.stringify(input.attributes),
        barcode: input.barcode ?? null,
        currentStock: 0,
        createdAt: now(),
        updatedAt: now(),
        archivedAt: null,
      });
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

    async createCollection(input: CreateCollectionInput) {
      return productsRepo.insertCollection({
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

    async findCollections() {
      return productsRepo.findCollections();
    },
  };
}
