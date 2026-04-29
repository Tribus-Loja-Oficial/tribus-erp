import type { AppDb } from "../db/client.js";
import { generateId } from "../utils/id.js";
import { NotFoundError, ConflictError } from "../errors/app-error.js";
import { createProductRepository } from "../repositories/product.repository.js";
import { createAuditRepository } from "../repositories/audit.repository.js";
import type {
  CreateProductInput,
  UpdateProductInput,
  CreateVariantInput,
  CreateCategoryInput,
  CreateCollectionInput,
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

export function createProductService(db: AppDb) {
  const productsRepo = createProductRepository(db);
  const auditRepo = createAuditRepository(db);
  const now = () => new Date().toISOString();

  return {
    async create(input: CreateProductInput, actorId?: string) {
      const existing = await productsRepo.findBySku(input.sku);
      if (existing) throw new ConflictError(`SKU '${input.sku}' already exists`);

      const slug = slugify(input.name);
      const product = await productsRepo.insert({
        id: generateId(),
        ...input,
        slug,
        description: input.description ?? null,
        shortDescription: input.shortDescription ?? null,
        categoryId: input.categoryId ?? null,
        collectionId: input.collectionId ?? null,
        niche: input.niche ?? null,
        barcode: input.barcode ?? null,
        ncm: input.ncm ?? null,
        cest: input.cest ?? null,
        cfopDefault: input.cfopDefault ?? null,
        origin: input.origin ?? "0",
        compareAtPriceCents: input.compareAtPriceCents ?? null,
        maxStock: input.maxStock ?? null,
        weightGrams: input.weightGrams ?? null,
        heightCm: null,
        widthCm: null,
        depthCm: null,
        currentStock: 0,
        imagesJson: "[]",
        attributesJson: "{}",
        metadataJson: "{}",
        createdAt: now(),
        updatedAt: now(),
        archivedAt: null,
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

      return product;
    },

    async findById(id: string) {
      const product = await productsRepo.findById(id);
      if (!product) throw new NotFoundError("Product", id);
      return product;
    },

    async findMany(params: ListProductsParams & { page?: number }) {
      const { page = 1, limit = 20, ...rest } = params;
      return productsRepo.findMany({ ...rest, limit, offset: (page - 1) * limit });
    },

    async findLowStock() {
      return productsRepo.findLowStock();
    },

    async update(id: string, input: UpdateProductInput, actorId?: string) {
      const existing = await productsRepo.findById(id);
      if (!existing) throw new NotFoundError("Product", id);

      if (input.sku && input.sku !== existing.sku) {
        const skuConflict = await productsRepo.findBySku(input.sku);
        if (skuConflict) throw new ConflictError(`SKU '${input.sku}' already exists`);
      }

      const updated = await productsRepo.update(id, input);

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
      const existing = await productsRepo.findById(id);
      if (!existing) throw new NotFoundError("Product", id);
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
