import type { AppDb } from "../db/client.js";
import type { ProductVariant } from "../db/schema/index.js";
import { generateId } from "../utils/id.js";
import { NotFoundError, ConflictError, BadRequestError } from "../errors/app-error.js";
import { createProductRepository } from "../repositories/product.repository.js";
import { createProductVariantRepository } from "../repositories/product-variant.repository.js";
import type { CreateVariantInput, UpdateProductVariantInput } from "../schemas/product.schemas.js";

export type ProductVariantApiRow = ProductVariant & { attributes: Record<string, string> };

function enrichVariant(row: ProductVariant): ProductVariantApiRow {
  let attributes: Record<string, string> = {};
  try {
    const o = JSON.parse(row.attributesJson || "{}") as unknown;
    if (o && typeof o === "object" && !Array.isArray(o)) {
      attributes = Object.fromEntries(
        Object.entries(o as Record<string, unknown>).map(([k, v]) => [k, String(v ?? "")]),
      );
    }
  } catch {
    attributes = {};
  }
  return { ...row, attributes };
}

export function createProductVariantService(db: AppDb) {
  const productsRepo = createProductRepository(db);
  const variantsRepo = createProductVariantRepository(db);
  const now = () => new Date().toISOString();

  async function assertSkuAvailable(sku: string, excludeVariantId?: string) {
    if (await productsRepo.findBySku(sku)) {
      throw new ConflictError(`SKU '${sku}' já existe num produto.`);
    }
    const v = await variantsRepo.findBySku(sku);
    if (v && v.id !== excludeVariantId) {
      throw new ConflictError(`SKU '${sku}' já existe numa variação.`);
    }
  }

  async function assertVariableParent(productId: string) {
    const p = await productsRepo.findById(productId);
    if (!p) throw new NotFoundError("Product", productId);
    if (p.productKind !== "variable") {
      throw new BadRequestError(
        'Só é possível gerir variações em produtos com estrutura "com variações".',
      );
    }
    return p;
  }

  return {
    enrichVariant,

    async listByProduct(productId: string): Promise<ProductVariantApiRow[]> {
      const p = await productsRepo.findById(productId);
      if (!p) throw new NotFoundError("Product", productId);
      if (p.productKind !== "variable") return [];
      const rows = await variantsRepo.findByProductIncludingArchived(productId);
      return rows.map(enrichVariant);
    },

    async create(input: CreateVariantInput): Promise<ProductVariantApiRow> {
      await assertVariableParent(input.productId);
      await assertSkuAvailable(input.sku);

      const externalRef = await variantsRepo.allocateNextExternalRef();
      const nm = input.name?.trim() ? input.name.trim() : null;

      const row = await variantsRepo.insert({
        id: generateId(),
        productId: input.productId,
        externalRef,
        sku: input.sku,
        name: nm,
        attributesJson: JSON.stringify(input.attributes ?? {}),
        salePriceCents: input.salePriceCents ?? null,
        costPriceCents: input.costPriceCents ?? null,
        promotionalPriceCents: input.promotionalPriceCents ?? null,
        eventPriceCents: input.eventPriceCents ?? null,
        wholesalePriceCents: input.wholesalePriceCents ?? null,
        controlsStock: input.controlsStock,
        currentStock: input.currentStock,
        minStock: input.minStock,
        idealStock: input.idealStock ?? null,
        barcode: input.barcode?.trim() ? input.barcode : null,
        weightGrams: input.weightGrams ?? null,
        lengthCm: input.lengthCm ?? null,
        widthCm: input.widthCm ?? null,
        heightCm: input.heightCm ?? null,
        mainImageFileId: input.mainImageFileId?.trim() ? input.mainImageFileId : null,
        metadataJson: input.metadata ? JSON.stringify(input.metadata) : "{}",
        status: input.status,
        createdAt: now(),
        updatedAt: now(),
        archivedAt: null,
        deletedAt: null,
      });

      await productsRepo.syncAggregatedStockFromVariants(input.productId);
      return enrichVariant(row);
    },

    async update(
      variantId: string,
      input: UpdateProductVariantInput,
      expectedProductId?: string,
    ): Promise<ProductVariantApiRow> {
      const existing = await variantsRepo.findByIdAny(variantId);
      if (!existing) throw new NotFoundError("ProductVariant", variantId);
      if (expectedProductId && existing.productId !== expectedProductId) {
        throw new BadRequestError("Variação não pertence a este produto.");
      }
      if (existing.archivedAt) {
        throw new BadRequestError("Variação arquivada — restaure antes de editar.");
      }
      const product = await productsRepo.findById(existing.productId);
      if (!product) throw new NotFoundError("Product", existing.productId);
      if (product.productKind !== "variable") {
        throw new BadRequestError("Produto não é variável.");
      }

      if (input.sku && input.sku !== existing.sku) {
        await assertSkuAvailable(input.sku, variantId);
      }

      const patch: Record<string, unknown> = {};
      if (input.sku !== undefined) patch.sku = input.sku;
      if (input.name !== undefined) {
        patch.name =
          input.name == null || String(input.name).trim() === "" ? null : String(input.name).trim();
      }
      if (input.attributes !== undefined) patch.attributesJson = JSON.stringify(input.attributes);
      if (input.salePriceCents !== undefined) patch.salePriceCents = input.salePriceCents;
      if (input.costPriceCents !== undefined) patch.costPriceCents = input.costPriceCents;
      if (input.promotionalPriceCents !== undefined)
        patch.promotionalPriceCents = input.promotionalPriceCents;
      if (input.eventPriceCents !== undefined) patch.eventPriceCents = input.eventPriceCents;
      if (input.wholesalePriceCents !== undefined)
        patch.wholesalePriceCents = input.wholesalePriceCents;
      if (input.controlsStock !== undefined) patch.controlsStock = input.controlsStock;
      if (input.currentStock !== undefined) patch.currentStock = input.currentStock;
      if (input.minStock !== undefined) patch.minStock = input.minStock;
      if (input.idealStock !== undefined) patch.idealStock = input.idealStock;
      if (input.barcode !== undefined) {
        patch.barcode =
          input.barcode == null || String(input.barcode).trim() === ""
            ? null
            : String(input.barcode).trim();
      }
      if (input.weightGrams !== undefined) patch.weightGrams = input.weightGrams;
      if (input.lengthCm !== undefined) patch.lengthCm = input.lengthCm;
      if (input.widthCm !== undefined) patch.widthCm = input.widthCm;
      if (input.heightCm !== undefined) patch.heightCm = input.heightCm;
      if (input.mainImageFileId !== undefined) {
        patch.mainImageFileId =
          input.mainImageFileId == null || String(input.mainImageFileId).trim() === ""
            ? null
            : String(input.mainImageFileId).trim();
      }
      if (input.metadata !== undefined) {
        patch.metadataJson =
          input.metadata == null ? "{}" : JSON.stringify(input.metadata as Record<string, unknown>);
      }
      if (input.status !== undefined) patch.status = input.status;

      const filtered = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
      if (Object.keys(filtered).length === 0) {
        return enrichVariant(existing);
      }

      await variantsRepo.update(variantId, filtered as never);
      await productsRepo.syncAggregatedStockFromVariants(existing.productId);
      const next = await variantsRepo.findByIdAny(variantId);
      if (!next) throw new NotFoundError("ProductVariant", variantId);
      return enrichVariant(next);
    },

    async archive(variantId: string, expectedProductId?: string): Promise<void> {
      const existing = await variantsRepo.findByIdAny(variantId);
      if (!existing) throw new NotFoundError("ProductVariant", variantId);
      if (expectedProductId && existing.productId !== expectedProductId) {
        throw new BadRequestError("Variação não pertence a este produto.");
      }
      if (existing.archivedAt) throw new BadRequestError("Variação já está arquivada.");
      await variantsRepo.archive(variantId);
      await productsRepo.syncAggregatedStockFromVariants(existing.productId);
    },

    async restore(variantId: string, expectedProductId?: string): Promise<void> {
      const existing = await variantsRepo.findByIdAny(variantId);
      if (!existing) throw new NotFoundError("ProductVariant", variantId);
      if (expectedProductId && existing.productId !== expectedProductId) {
        throw new BadRequestError("Variação não pertence a este produto.");
      }
      if (!existing.archivedAt) throw new BadRequestError("Variação não está arquivada.");
      await variantsRepo.restore(variantId);
      await productsRepo.syncAggregatedStockFromVariants(existing.productId);
    },
  };
}
